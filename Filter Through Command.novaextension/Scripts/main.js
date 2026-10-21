const EXTENSION_IDENTIFIER = "com.gingerbeardman.FilterThroughCommand"

exports.activate = function() {
    nova.subscriptions.add(nova.commands.register("com.gingerbeardman.FilterThroughCommand.resetCommands", resetCommands));
    nova.subscriptions.add(nova.commands.register("com.gingerbeardman.FilterThroughCommand", filterThroughCommand));
    nova.subscriptions.add(nova.commands.register("com.gingerbeardman.FilterThroughCommandCustom", filterThroughCommandCustom));
    nova.subscriptions.add(nova.commands.register("com.gingerbeardman.FilterThroughCommandRerun", filterThroughCommandRerun));
}

const COMMAND_TIMEOUT_MS = 30 * 1000; // Kill commands that run longer than this
const MAX_OUTPUT_LENGTH = 10 * 1024 * 1024; // Kill commands that output more than this

function resetCommands() {
    try {
        console.log("Resetting commands...");
        nova.config.remove(`${EXTENSION_IDENTIFIER}.commandList`);
        nova.workspace.showInformativeMessage("Command List has been reset to Defaults.");
    } catch (error) {
        console.error("Error resetting commands:", error);
        nova.workspace.showErrorMessage("Failed to reset commands: " + error.message);
    }
}

function filterThroughCommand(editor) {
    const commands = nova.config.get(`${EXTENSION_IDENTIFIER}.commandList`) || ["sort -n"];
    
    let options = {
        placeholder: "Type to filter commands"
    };
    
    nova.workspace.showChoicePalette(commands, options, (command) => {
        if (command === null || command === undefined) return; // User cancelled
        executeCommand(editor, command.trim() || commands[0]);
    });
}

function filterThroughCommandCustom(editor) {
    const command = nova.config.get(`${EXTENSION_IDENTIFIER}.commandCustom`) || ["sort -n"];
    
    nova.workspace.showInputPalette("Enter custom command", {
        placeholder: "e.g., sort -n",
        value: command
    }, (command) => {
        if (command === null || command === undefined) return; // User cancelled
        const commandTrimmed = command.trim();
        nova.config.set(`${EXTENSION_IDENTIFIER}.commandCustom`, commandTrimmed);
        executeCommand(editor, commandTrimmed);
    });
}

function filterThroughCommandRerun(editor) {
    const command = nova.config.get(`${EXTENSION_IDENTIFIER}.commandCustom`);
    
    if (!command) {
        nova.workspace.showErrorMessage("No custom command has been run yet. Use 'Filter Through Custom Command...' first.");
        return;
    }
    
    executeCommand(editor, command);
}

function executeCommand(editor, command) {
    const shell = nova.config.get(`${EXTENSION_IDENTIFIER}.shell`);
    const outputMode = nova.config.get(`${EXTENSION_IDENTIFIER}.outputMode`);
    const selectAllIfNoneSelected = nova.config.get(`${EXTENSION_IDENTIFIER}.selectAllIfNoneSelected`) !== false; // Default to true
    
    let selectedRanges = editor.selectedRanges;
    let autoSelectedAll = false; // Track if we auto-selected all text
    
    if (selectedRanges.length === 0 || (selectedRanges.length === 1 && selectedRanges[0].empty)) {
        if (selectAllIfNoneSelected) {
            // Select all text in the document
            const documentRange = new Range(0, editor.document.length);
            editor.selectedRanges = [documentRange];
            selectedRanges = editor.selectedRanges;
            autoSelectedAll = true;
        } else {
            nova.workspace.showErrorMessage("No text selected");
            return;
        }
    }
    
    // Run the command once per range, then apply all results in a single edit
    const runs = selectedRanges.map((range) => runCommand(shell, command, editor.getTextInRange(range)));
    
    Promise.all(runs).then((results) => {
        const succeeded = [];
        results.forEach((result, index) => {
            if (result.error) {
                nova.workspace.showErrorMessage(`Command failed: ${result.error}`);
            } else {
                succeeded.push({ range: selectedRanges[index], output: result.stdout.trim() });
            }
        });
        
        if (succeeded.length === 0) return;
        
        if (outputMode === "new") {
            succeeded.forEach((item) => {
                nova.workspace.openNewTextDocument({
                    content: item.output
                });
            });
            return;
        }
        
        // Apply in reverse document order so earlier ranges are not shifted by later edits
        const ordered = succeeded.slice().sort((a, b) => b.range.start - a.range.start);
        
        editor.edit((edit) => {
            ordered.forEach((item) => {
                switch (outputMode) {
                    case "replace":
                        edit.replace(item.range, item.output);
                        break;
                    case "insert":
                        edit.insert(item.range.end, "\n" + item.output);
                        break;
                }
            });
        }).then(() => {
            // If we auto-selected all text, deselect after successful edit
            if (autoSelectedAll) {
                editor.selectedRanges = [];
            }
        });
    });
}

function runCommand(shell, command, input) {
    return new Promise((resolve) => {
        let process = new Process(shell, {
            args: ["-c", command],
            stdio: ["pipe", "pipe", "pipe"]
        });
        
        let stdout = "";
        let stderr = "";
        let failure = null;
        
        const timeout = setTimeout(() => {
            failure = `timed out after ${COMMAND_TIMEOUT_MS / 1000} seconds`;
            process.kill();
        }, COMMAND_TIMEOUT_MS);
        
        process.onStdout((line) => {
            if (failure) return;
            stdout += line;
            if (stdout.length > MAX_OUTPUT_LENGTH) {
                failure = `output exceeded ${MAX_OUTPUT_LENGTH / (1024 * 1024)} MB`;
                stdout = "";
                process.kill();
            }
        });
        process.onStderr((line) => {
            if (stderr.length < MAX_OUTPUT_LENGTH) stderr += line;
        });
        
        process.onDidExit((status) => {
            clearTimeout(timeout);
            if (failure) {
                resolve({ error: failure });
            } else if (status === 0) {
                resolve({ stdout: stdout });
            } else {
                resolve({ error: stderr });
            }
        });
        
        try {
            process.start();
        } catch (error) {
            clearTimeout(timeout);
            resolve({ error: error.message });
            return;
        }
        
        if (process.stdin) {
            let writer = process.stdin.getWriter();
            writer.write(input);
            writer.close();
        }
    });
}