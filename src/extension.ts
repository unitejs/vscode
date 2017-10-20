/**
 * Extension
 */
import { ErrorHandler } from "unitejs-framework/dist/helpers/errorHandler";
import * as vscode from "vscode";
import { Executor } from "./executor";
import * as shimUtilPromisify from "util.promisify/shim";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        shimUtilPromisify();
        const executor = new Executor();
        await executor.initialise();
        await executor.registerCommands(context);
    } catch (err) {
        const outputChannel = vscode.window.createOutputChannel("UniteJS");

        outputChannel.appendLine("There was a problem initialising the extension:");
        outputChannel.appendLine(ErrorHandler.format(err));
    }
}
