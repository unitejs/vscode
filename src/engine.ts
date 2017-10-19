import { ErrorHandler } from "unitejs-framework/dist/helpers/errorHandler";
import { ISpdx } from "unitejs-engine/dist/configuration/models/spdx/ISpdx";
import { UniteConfiguration } from "unitejs-engine/dist/configuration/models/unite/uniteConfiguration";
import { IFileSystem } from "unitejs-framework/dist/interfaces/IFileSystem";
import { FileSystem } from "unitejs-cli-core/dist/fileSystem";
import * as vscode from "vscode";

export class Engine {
    private static TERMINAL_NAME: string = "UniteJS";
    private static CONFIG_FILENAME: string = "unite.json";

    private _fileSystem: IFileSystem;

    private _uniteJsonLocation: string;
    private _engineLocation: string;

    private _terminal: vscode.Terminal;

    public async initialise(): Promise<void> {
        this._fileSystem = new FileSystem();

        this._uniteJsonLocation = await this.findConfigFolder(vscode.workspace.rootPath);
        this._engineLocation = this._fileSystem.pathCombine(
            vscode.extensions.getExtension("unitejs.unitejs-vscode").extensionPath,
            "node_modules/unitejs-engine"
        );

        this.createTerminal();

        vscode.window.onDidCloseTerminal((e) => {
            if (e.name === Engine.TERMINAL_NAME) {
                this._terminal = undefined;
            }
        });
    }

    public registerCommands(context: vscode.ExtensionContext): void {
        const commands = [
            "Version",
            "Help",
            "ConfigureUpdate",
            "ConfigureProfile",
            "ConfigureOptions",
            "ConfigureOptionsNoExecute",
            "InstallPackages",
            "BuildConfigurationAdd",
            "BuildConfigurationRemove",
            "Generate",
            "ClientPackageAddOptions",
            "ClientPackageAddProfile",
            "ClientPackageRemove",
            "PlatformAdd",
            "PlatformRemove",
            "TaskBuild",
            "TaskBuildWatch",
            "TaskThemeBuild",
            "TaskUnit",
            "TaskUnitSingle",
            "TaskE2EInstall",
            "TaskE2E",
            "TaskE2ESingle",
            "TaskServe"
        ];

        commands.forEach(command => {
            context.subscriptions.push(vscode.commands.registerCommand(
                `extension.unitejs.${command[0].toLowerCase() + command.substring(1)}`,
                () => this.handleError(() => this[`command${command}`].call(this))
            ));
        });
    }

    private createTerminal(): void {
        if (!this._terminal) {
            this._terminal = vscode.window.createTerminal(Engine.TERMINAL_NAME);
        }
        this._terminal.show();
    }

    private async exec(args: string[], execute: boolean = true): Promise<void> {
        this.createTerminal();
        this._terminal.sendText(args.join(" "), execute);
    }

    private async loadConfiguration(): Promise<UniteConfiguration> {
        return this._fileSystem.fileReadJson<UniteConfiguration>(this._uniteJsonLocation, Engine.CONFIG_FILENAME);
    }

    private async findConfigFolder(outputDirectory: string | null | undefined): Promise<string> {
        let initialDir = this._fileSystem.pathAbsolute(outputDirectory);

        let outputDir = initialDir;

        // check to see if this folder contains unite.json if it doesn't then keep recursing up
        // until we find it
        let searchComplete = false;
        let found = false;
        do {
            found = await this._fileSystem.fileExists(outputDir, Engine.CONFIG_FILENAME);

            if (found) {
                searchComplete = true;
            } else {
                const newOutputDir = this._fileSystem.pathCombine(outputDir, "../");

                // recursing up didn't move so we have reached the end of our search
                if (newOutputDir === outputDir) {
                    searchComplete = true;
                } else {
                    outputDir = newOutputDir;
                }
            }
        }
        while (!searchComplete);

        // not found at all so set outputDir back to initialDir in case this is a new creation
        if (!found) {
            outputDir = initialDir;
        }

        return outputDir;
    }

    private async getProfileOptions(profileType: string): Promise<string[]> {
        const profilesFolder = this._fileSystem.pathCombine(this._engineLocation, "/assets/profiles/");
        const profiles = await this._fileSystem.fileReadJson<{ [id: string]: any }>(profilesFolder, `${profileType}.json`);
        return Object.keys(profiles);
    }

    private async getLicenseOptions(): Promise<string[]> {
        const assetsFolder = this._fileSystem.pathCombine(this._engineLocation, "/assets/");
        const licenses = await this._fileSystem.fileReadJson<ISpdx>(assetsFolder, "spdx-full.json");
        return ["None"].concat(Object.keys(licenses));
    }

    private async getBooleanOptions(): Promise<string[]> {
        return ["true", "false"];
    }

    private async getPipelineOptions(pipelineStepType: string, addNone: boolean = false): Promise<string[]> {
        const pipelineStepsFolder = this._fileSystem.pathCombine(this._engineLocation,
            `dist/pipelineSteps/${pipelineStepType}`);

        const files = await this._fileSystem.directoryGetFiles(pipelineStepsFolder);

        return (addNone ? ["None"] : [])
            .concat(
            files
                .filter(file => file.endsWith(".js"))
                .map(file => file[0].toUpperCase() + file.substring(1).replace(/\.js/, "")));
    }

    private async getGenerateOptions(applicationFramework: string): Promise<string[]> {
        const generateFolder = this._fileSystem.pathCombine(this._engineLocation, `/assets/appFramework/${applicationFramework.toLowerCase()}/generate/`);
        const generateTypes = await this._fileSystem.fileReadJson<{ [id: string]: any }>(generateFolder, `generate-templates.json`);
        return Object.keys(generateTypes);
    }

    private handleError(method: () => Promise<any>): void {
        method().catch((err) => {
            vscode.window.showErrorMessage(`There was a problem running the extension command: ${ErrorHandler.format(err)}`);
        });
    }

    private async commandVersion(): Promise<void> {
        return this.exec(["unite", "version"]);
    }

    private async commandHelp(): Promise<void> {
        return this.exec(["unite", "help"]);
    }

    private async commandConfigureProfile(): Promise<void> {
        const profile = await this.quickPick("Configuration profile ?", await this.getProfileOptions("configure"));
        if (profile) {
            const packageName = await this.inputBox("Please enter a package name ?");
            if (packageName) {
                const title = await this.inputBox("Please enter a title ?");
                if (title) {
                    return this.exec(["unite",
                        "configure",
                        `--profile=${profile}`,
                        `--packageName=${packageName}`,
                        `--title="${title}"`,
                        `--outputDirectory="${this._uniteJsonLocation}"`
                    ]);
                }
            }
        }
    }

    private async commandConfigureOptions(): Promise<void> {
        return this.internalCommandConfigureOptions(true);
    }

    private async commandConfigureOptionsNoExecute(): Promise<void> {
        return this.internalCommandConfigureOptions(false);
    }

    private async internalCommandConfigureOptions(execute: boolean): Promise<void> {
        const packageName = await this.inputBox("Please enter a package name ?");
        if (packageName) {
            const title = await this.inputBox("Please enter a title ?");
            if (title) {

                const license = await this.quickPick("License", await this.getLicenseOptions());
                if (license) {
                    const parameters: { key: string, dir?: string, value?: string, addNone?: boolean, showCondition?: () => boolean }[] = [
                        { key: "appFramework", dir: "applicationFramework" },
                        { key: "sourceLanguage", dir: "language" },
                        { key: "linter", addNone: true },
                        { key: "moduleType" },
                        { key: "bundler" },
                        { key: "unitTestRunner", addNone: true },
                        { key: "unitTestFramework", dir: "testFramework", showCondition: () => parameters.find(param => param.key === "unitTestRunner").value !== "None" },
                        { key: "unitTestEngine", showCondition: () => parameters.find(param => param.key === "unitTestRunner").value !== "None" },
                        { key: "e2eTestRunner", addNone: true },
                        { key: "e2eTestFramework", dir: "testFramework", showCondition: () => parameters.find(param => param.key === "e2eTestRunner").value !== "None" },
                        { key: "cssPre" },
                        { key: "cssPost" },
                        { key: "packageManager" }
                    ];

                    for (let i = 0; i < parameters.length; i++) {
                        const show = !parameters[i].showCondition || parameters[i].showCondition();

                        if (show) {
                            parameters[i].value = await this.quickPick(`${parameters[i].key} ?`,
                                await this.getPipelineOptions(parameters[i].dir ? parameters[i].dir : parameters[i].key, parameters[i].addNone));

                            if (!parameters[i].value) {
                                return;
                            }
                        }
                    }

                    const args = ["unite",
                        "configure",
                        `--packageName=${packageName}`,
                        `--title="${title}"`,
                        `--license=${license}`
                    ];

                    parameters.forEach(param => {
                        const show = !param.showCondition || param.showCondition();

                        if (show) {
                            args.push(`--${param.key}=${param.value}`);
                        }
                    });

                    args.push(`--ides=vscode`);
                    args.push(`--outputDirectory="${this._uniteJsonLocation}"`);

                    return this.exec(args, execute);
                }
            }
        }
    }

    private async commandConfigureUpdate(): Promise<void> {
        return this.exec(["unite",
            "configure",
            `--outputDirectory="${this._uniteJsonLocation}"`
        ]);
    }

    private async relocateToPackageJsonFolder() : Promise<UniteConfiguration> {
        const uniteConfig = await this.loadConfiguration();

        const wwwFolder = this._fileSystem.pathCombine(this._uniteJsonLocation, uniteConfig.dirs.wwwRoot);

        await this.exec([]);
        return await this.exec(["cd", wwwFolder])
            .then(()=> uniteConfig);
    }

    private async commandInstallPackages(): Promise<void> {
        const uniteConfig = await this.relocateToPackageJsonFolder();

        const packageManager = uniteConfig.packageManager.toLowerCase();
        if (packageManager === "npm") {
            return this.exec(["npm", "install"]);
        } else if (packageManager === "yarn") {
            return this.exec(["yarn", "install"]);
        }
    }

    private async commandBuildConfigurationAdd(): Promise<void> {
        const configurationName = await this.inputBox("Please enter a build configuration name ?");
        if (configurationName) {
            const bundle = await this.quickPick("Bundle the build ?", await this.getBooleanOptions());
            if (bundle) {
                const minify = await this.quickPick("Minify the build ?", await this.getBooleanOptions());
                if (minify) {
                    const sourcemaps = await this.quickPick("Add sourcemaps to the build ?", await this.getBooleanOptions());
                    if (sourcemaps) {
                        return this.exec(["unite",
                            "buildConfiguration",
                            `--operation=add`,
                            `--configurationName=${configurationName}`,
                            `--bundle=${bundle}`,
                            `--minify=${minify}`,
                            `--sourcemaps=${sourcemaps}`,
                            `--outputDirectory="${this._uniteJsonLocation}"`
                        ]);
                    }
                }
            }
        }
    }

    private async commandBuildConfigurationRemove(): Promise<void> {
        const uniteConfiguration = await this.loadConfiguration();
        const configurationName = await this.quickPick("Build configuration to remove ?", Object.keys(uniteConfiguration.buildConfigurations));
        if (configurationName) {
            return this.exec(["unite",
                "buildConfiguration",
                `--operation=remove`,
                `--configurationName=${configurationName}`,
                `--outputDirectory="${this._uniteJsonLocation}"`
            ]);
        }
    }

    private async commandGenerate(): Promise<void> {
        const uniteConfiguration = await this.loadConfiguration();

        const generateType = await this.quickPick("Generate type ?", await this.getGenerateOptions(uniteConfiguration.applicationFramework));
        if (generateType) {
            const name = await this.inputBox("Please enter a human name for your new item ?");
            if (name) {
                return this.exec(["unite",
                    "generate",
                    `--name="${name}"`,
                    `--type=${generateType}`,
                    `--outputDirectory="${this._uniteJsonLocation}"`
                ]);
            }
        }
    }
    
    private async commandClientPackageAddProfile(): Promise<void> {
        const profile = await this.quickPick("Client package profile ?", await this.getProfileOptions("clientPackage"));
        if (profile) {
            return this.exec(["unite",
                "clientPackage",
                `--operation=add`,
                `--profile=${profile}`,
                `--outputDirectory="${this._uniteJsonLocation}"`
            ]);
        }
    }
    
    private async commandClientPackageAddOptions(): Promise<void> {
        const packageName = await this.inputBox("Package name ?");
        if (packageName) {

            const version = await this.inputBox("Version (leave blank for latest) ?");
            const args = ["unite",
                "clientPackage",
                `--operation=add`,
                `--packageName=${packageName}`
            ];

            if (version !== undefined) {
                args.push(`--version=${version}`);
            }

            args.push(`--outputDirectory="${this._uniteJsonLocation}"`);
            
            return this.exec(args);
        }
    }
    
    private async commandClientPackageRemove(): Promise<void> {
        const uniteConfiguration = await this.loadConfiguration();
        const clientPackage = await this.quickPick("Client package to remove ?", Object.keys(uniteConfiguration.clientPackages));
        if (clientPackage) {
            return this.exec(["unite",
                "clientPackage",
                `--operation=remove`,
                `--packageName=${clientPackage}`,
                `--outputDirectory="${this._uniteJsonLocation}"`
            ]);
        }
    }
    
    private async commandPlatformAdd(): Promise<void> {
        const platform = await this.quickPick("Platform to add ?", await this.getPipelineOptions("platform"));
        if (platform) {
            return this.exec(["unite",
                "platform",
                `--operation=add`,
                `--platformName=${platform}`,
                `--outputDirectory="${this._uniteJsonLocation}"`
            ]);
        }
    }
    
    private async commandPlatformRemove(): Promise<void> {
        const uniteConfiguration = await this.loadConfiguration();
        const platform = await this.quickPick("Platform to remove ?", Object.keys(uniteConfiguration.platforms));
        if (platform) {
            return this.exec(["unite",
                "platform",
                `--operation=remove`,
                `--platformName=${platform}`,
                `--outputDirectory="${this._uniteJsonLocation}"`
            ]);
        }
    }
    
    private async commandTaskBuild(): Promise<void> {
        await this.relocateToPackageJsonFolder();

        return this.exec(["gulp",
            "build"
        ]);
    }
    
    private async commandTaskBuildWatch(): Promise<void> {
        await this.relocateToPackageJsonFolder();

        return this.exec(["gulp",
            "build",
            "--watch"
        ]);
    }
    
    private async commandTaskThemeBuild(): Promise<void> {
        await this.relocateToPackageJsonFolder();

        return this.exec(["gulp",
            "theme-build"
        ]);
    }

    private async commandTaskUnit(): Promise<void> {
        const uniteConfig = await this.relocateToPackageJsonFolder();

        if (uniteConfig.unitTestRunner === "None") {
            vscode.window.showErrorMessage("Your UniteJS configuration does not specify a unit test runner");
        } else {
            return this.exec(["gulp",
                "unit"
            ]);
        }
    }
    
    private async commandTaskUnitSingle(): Promise<void> {
        const uniteConfig = await this.relocateToPackageJsonFolder();

        if (uniteConfig.unitTestRunner === "None") {
            vscode.window.showErrorMessage("Your UniteJS configuration does not specify a unit test runner");
        } else {
            const grep = await this.inputBox("Which test to run ?");
            if (grep) {
                return this.exec(["gulp",
                    "unit",
                    `--grep=${grep}`
                ]);
            }
        }
    }
    
    private async commandTaskE2EInstall(): Promise<void> {
        const uniteConfig = await this.relocateToPackageJsonFolder();

        if (uniteConfig.e2eTestRunner === "None") {
            vscode.window.showErrorMessage("Your UniteJS configuration does not specify a e2e test runner");
        } else {
            return this.exec(["gulp",
                "e2e-install"
            ]);
        };
    }

    private async commandTaskE2E(): Promise<void> {
        const uniteConfig = await this.relocateToPackageJsonFolder();

        if (uniteConfig.e2eTestRunner === "None") {
            vscode.window.showErrorMessage("Your UniteJS configuration does not specify a e2e test runner");
        } else {
            return this.exec(["gulp",
                "e2e"
            ]);
        }
    }
    
    private async commandTaskE2ESingle(): Promise<void> {
        const uniteConfig = await this.relocateToPackageJsonFolder();

        if (uniteConfig.e2eTestRunner === "None") {
            vscode.window.showErrorMessage("Your UniteJS configuration does not specify a e2e test runner");
        } else {
            const grep = await this.inputBox("Which test to run ?");
            if (grep) {
                return this.exec(["gulp",
                    "e2e",
                    `--grep=${grep}`
                ]);
            }
        }
    }

    private async commandTaskServe(): Promise<void> {
        await this.relocateToPackageJsonFolder();

        return this.exec(["gulp",
            "serve"
        ]);
    }    

    private quickPick(prompt: string, choices: string[]): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            vscode.window.showQuickPick(choices, { placeHolder: prompt })
                .then((val) => {
                    resolve(val);
                },
                (err) => {
                    reject(err);
                });
        });
    }

    private inputBox(prompt: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            vscode.window.showInputBox({ prompt })
                .then((val) => {
                    resolve(val);
                },
                (err) => {
                    reject(err);
                });
        });
    }
}
