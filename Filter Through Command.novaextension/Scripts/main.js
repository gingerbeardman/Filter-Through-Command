const EXTENSION_IDENTIFIER = "com.gingerbeardman.FilterThroughCommand"

exports.activate = function() {
    nova.commands.register("com.gingerbeardman.FilterThroughCommand.resetCommands", resetCommands);
    nova.commands.register("com.gingerbeardman.FilterThroughCommand", filterThroughCommand);
    nova.commands.register("com.gingerbeardman.FilterThroughCommandCustom", filterThroughCommandCustom);
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
        placeholder: "Enter command or choose"
    };
    
    nova.workspace.showChoicePalette(commands, options, (command) => {
        if (command === null || command === undefined) return; // User cancelled
        executeCommand(editor, command.trim() || commands[0]);
    });
}

function filterThroughCommandCustom(editor) {
    nova.workspace.showInputPalette("Enter custom command:", {
        placeholder: "e.g., sort -n"
    }, (command) => {
        if (command === null || command === undefined) return; // User cancelled
        executeCommand(editor, command.trim());
    });
}

function executeCommand(editor, command) {
    const shell = nova.config.get(`${EXTENSION_IDENTIFIER}.shell`);
    const outputMode = nova.config.get(`${EXTENSION_IDENTIFIER}.outputMode`);
    
    let selectedRanges = editor.selectedRanges;
    
    if (selectedRanges.length === 0 || (selectedRanges.length === 1 && selectedRanges[0].empty)) {
        nova.workspace.showErrorMessage("No text selected");
        return;
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