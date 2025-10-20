const EXTENSION_IDENTIFIER = "com.gingerbeardman.FilterThroughCommand"

exports.activate = function() {
    nova.commands.register("com.gingerbeardman.FilterThroughCommand.resetCommands", resetCommands);
    nova.commands.register("com.gingerbeardman.FilterThroughCommand", filterThroughCommand);
    nova.commands.register("com.gingerbeardman.FilterThroughCommandCustom", filterThroughCommandCustom);
    nova.commands.register("com.gingerbeardman.FilterThroughCommandRerun", filterThroughCommandRerun);
}

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
    
    selectedRanges.forEach((range) => {
        let selectedText = editor.getTextInRange(range);
        
        let process = new Process(shell, {
            args: ["-c", command],
            stdio: ["pipe", "pipe", "pipe"]
        });
        
        let stdout = "";
        let stderr = "";
        
        process.onStdout((line) => stdout += line);
        process.onStderr((line) => stderr += line);
        
        process.onDidExit((status) => {
            if (status === 0) {
                editor.edit((edit) => {
                    switch (outputMode) {
                        case "replace":
                            edit.replace(range, stdout.trim());
                            break;
                        case "insert":
                            edit.insert(range.end, "\n" + stdout.trim());
                            break;
                        case "new":
                            nova.workspace.openNewTextDocument({
                                content: stdout.trim()
                            });
                            break;
                    }
                }).then(() => {
                    // If we auto-selected all text, deselect after successful edit
                    if (autoSelectedAll) {
                        editor.selectedRanges = [];
                    }
                });
            } else {
                nova.workspace.showErrorMessage(`Command failed: ${stderr}`);
            }
        });
        
        process.start();
        
        if (process.stdin) {
            let writer = process.stdin.getWriter();
            writer.write(selectedText);
            writer.close();
        }
    });
}