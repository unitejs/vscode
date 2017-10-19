import { ErrorHandler } from "unitejs-framework/dist/helpers/errorHandler";
import * as vscode from "vscode";
import { Engine } from "./engine";
import * as shimUtilPromisify from "util.promisify/shim";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        shimUtilPromisify();
        const engine = new Engine();
        await engine.initialise();
        await engine.registerCommands(context);
    } catch (err) {
        const outputChannel = vscode.window.createOutputChannel("UniteJS");

        outputChannel.appendLine("There was a problem initialising the extension:");
        outputChannel.appendLine(ErrorHandler.format(err));
    }
}
