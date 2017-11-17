/**
 * Executor
 */
import { ErrorHandler } from "unitejs-framework/dist/helpers/errorHandler";
import { ISpdx } from "unitejs-engine/dist/configuration/models/spdx/ISpdx";
import { UniteConfiguration } from "unitejs-engine/dist/configuration/models/unite/uniteConfiguration";
import { ConfigHelper } from "unitejs-engine/dist/engine/configHelper";
import { PipelineLocator } from "unitejs-engine/dist/engine/pipelineLocator";
import { IFileSystem } from "unitejs-framework/dist/interfaces/IFileSystem";
import { FileSystem } from "unitejs-cli-core/dist/fileSystem";
import * as vscode from "vscode";

export class Executor {
    private static TERMINAL_NAME: string = "Unite";
    private static CONFIG_FILENAME: string = "unite.json";

    private _fileSystem: IFileSystem;

    private _uniteJsonLocation: string;
    private _engineRootFolder: string;

    private _terminal: vscode.Terminal;

    public async initialise(): Promise<void> {
        this._fileSystem = new FileSystem();

        this._uniteJsonLocation = await ConfigHelper.findConfigFolder(this._fileSystem, vscode.workspace.rootPath);
        this._engineRootFolder = this._fileSystem.pathCombine(
            vscode.extensions.getExtension("unitejs.unitejs-vscode").extensionPath,
            "node_modules/unitejs-engine"
        );

        vscode.window.onDidCloseTerminal((e) => {
            if (e.name === Executor.TERMINAL_NAME) {
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
            "TaskBuildConfiguration",
            "TaskBuildWatch",
            "TaskThemeBuild",
            "TaskUnit",
            "TaskUnitSingle",
            "TaskUnitWatch",
            "TaskUnitOptions",
            "TaskE2EInstall",
            "TaskE2EInstallOptions",
            "TaskE2E",
            "TaskE2ESingle",
            "TaskE2EOptions",
            "TaskServe",
            "TaskServeOptions",
            "TaskPlatformCordovaDev",
            "TaskPlatformCordovaDevOptions",
            "TaskPlatformCordovaTheme",
            "TaskPlatformCordovaThemeOptions",
            "TaskPlatformDockerPackage",
            "TaskPlatformDockerPackageOptions",
            "TaskPlatformElectronDev",
            "TaskPlatformElectronDevOptions",
            "TaskPlatformElectronPackage",
            "TaskPlatformElectronPackageOptions",
            "TaskPlatformWebPackage"
        ];

        commands.forEach(command => {
            context.subscriptions.push(vscode.commands.registerCommand(
                `extension.unitejs.${command[0].toLowerCase() + command.substring(1)}`,
                () => this.handleError(() => this[`command${command}`].call(this))
            ));
        });
    }

    private async exec(args: string[], newTerminal: boolean, execute: boolean): Promise<void> {
        if (newTerminal && this._terminal) {
            this._terminal.dispose();
            this._terminal = undefined;
        }
        if (!this._terminal) {
            this._terminal = vscode.window.createTerminal(Executor.TERMINAL_NAME);
        }
        this._terminal.show();
        vscode.commands.executeCommand("workbench.action.terminal.clear")
            .then(() => {
                this._terminal.sendText(args.join(" "), execute);
            })
    }

    private async loadConfiguration(): Promise<UniteConfiguration> {
        try {
            return this._fileSystem.fileReadJson<UniteConfiguration>(this._uniteJsonLocation, Executor.CONFIG_FILENAME);
        } catch {
            vscode.window.showErrorMessage(`Failed to load unite.json configuration file, make sure you have created a UniteJS installation using 'unite configure'`);
            return undefined;
        }
    }

    private async getProfileOptions(profileType: string): Promise<string[]> {
        const profilesFolder = this._fileSystem.pathCombine(this._engineRootFolder, "/assets/profiles/");
        const profiles = await this._fileSystem.fileReadJson<{ [id: string]: any }>(profilesFolder, `${profileType}.json`);
        return Object.keys(profiles);
    }

    private async getLicenseOptions(): Promise<string[]> {
        const assetsFolder = this._fileSystem.pathCombine(this._engineRootFolder, "/assets/");
        const licenses = await this._fileSystem.fileReadJson<ISpdx>(assetsFolder, "spdx-full.json");
        return ["None"].concat(Object.keys(licenses));
    }

    private async getBooleanOptions(): Promise<string[]> {
        return ["true", "false"];
    }

    private async getReverseBooleanOptions(): Promise<string[]> {
        return ["false", "true"];
    }

    private async getPipelineOptions(category: string, addNone: boolean = false): Promise<string[]> {
        const items = await PipelineLocator.getPipelineCategoryItems(this._fileSystem, this._engineRootFolder, category);

        return (addNone ? ["None"] : []).concat(items.map(file => file[0].toUpperCase() + file.substring(1)));
    }

    private async getGenerateOptions(applicationFramework: string): Promise<string[]> {
        const generateFolder = this._fileSystem.pathCombine(this._engineRootFolder, `/assets/appFramework/${applicationFramework.toLowerCase()}/generate/`);
        const generateTypes = await this._fileSystem.fileReadJson<{ [id: string]: any }>(generateFolder, `generate-templates.json`);
        return Object.keys(generateTypes);
    }

    private handleError(method: () => Promise<any>): void {
        method().catch((err) => {
            vscode.window.showErrorMessage(`There was a problem running the extension command: ${ErrorHandler.format(err)}`);
        });
    }

    private async commandVersion(): Promise<void> {
        return this.exec(["unite", "version"], true, true);
    }

    private async commandHelp(): Promise<void> {
        return this.exec(["unite", "help"], true, true);
    }

    private async commandConfigureProfile(): Promise<void> {
        const profile = await this.quickPick("Configuration profile ?", await this.getProfileOptions("configure"));
        if (profile !== undefined) {
            const packageName = await this.inputBox("Please enter a package name ?");
            if (packageName !== undefined) {
                const title = await this.inputBox("Please enter a title ?");
                if (title !== undefined) {
                    return this.exec(["unite",
                        "configure",
                        `--profile=${profile}`,
                        `--packageName=${packageName}`,
                        `--title="${title}"`,
                        `--outputDirectory="${this._uniteJsonLocation}"`
                    ], true, true);
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
        if (packageName !== undefined) {
            const title = await this.inputBox("Please enter a title ?");
            if (title !== undefined) {
                const license = await this.quickPick("License", await this.getLicenseOptions());
                if (license !== undefined) {
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
                        { key: "cssLinter" },
                        { key: "packageManager" }
                    ];

                    for (let i = 0; i < parameters.length; i++) {
                        const show = !parameters[i].showCondition || parameters[i].showCondition();

                        if (show) {
                            parameters[i].value = await this.quickPick(`${parameters[i].key} ?`,
                                await this.getPipelineOptions(parameters[i].dir ? parameters[i].dir : parameters[i].key, parameters[i].addNone));

                            if (parameters[i].value === undefined) {
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

                    return this.exec(args, true, execute);
                }
            }
        }
    }

    private async commandConfigureUpdate(): Promise<void> {
        return this.exec(["unite",
            "configure",
            `--outputDirectory="${this._uniteJsonLocation}"`
        ], true, true);
    }

    private async relocateToPackageJsonFolder(uniteConfig: UniteConfiguration): Promise<void> {
        const wwwFolder = this._fileSystem.pathCombine(this._uniteJsonLocation, uniteConfig.dirs.wwwRoot);

        return this.exec(["cd", wwwFolder], true, true);
    }

    private async commandInstallPackages(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            await this.relocateToPackageJsonFolder(uniteConfig);

            const packageManager = uniteConfig.packageManager.toLowerCase();
            if (packageManager === "npm") {
                return this.exec(["npm", "install"], false, true);
            } else if (packageManager === "yarn") {
                return this.exec(["yarn", "install"], false, true);
            }
        }
    }

    private async commandBuildConfigurationAdd(): Promise<void> {
        const configurationName = await this.inputBox("Please enter a build configuration name ?");
        if (configurationName !== undefined) {
            const bundle = await this.quickPick("Bundle the build ?", await this.getBooleanOptions());
            if (bundle !== undefined) {
                const minify = await this.quickPick("Minify the build ?", await this.getBooleanOptions());
                if (minify !== undefined) {
                    const sourcemaps = await this.quickPick("Add sourcemaps to the build ?", await this.getBooleanOptions());
                    if (sourcemaps !== undefined) {
                        const pwa = await this.quickPick("Enable PWA for the build ?", await this.getBooleanOptions());
                        if (pwa !== undefined) {
                            return this.exec(["unite",
                                "buildConfiguration",
                                `--operation=add`,
                                `--configurationName=${configurationName}`,
                                `--bundle=${bundle}`,
                                `--minify=${minify}`,
                                `--pwa=${pwa}`,
                                `--sourcemaps=${sourcemaps}`,
                                `--outputDirectory="${this._uniteJsonLocation}"`
                            ], true, true);
                        }
                    }
                }
            }
        }
    }

    private async commandBuildConfigurationRemove(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            const configurationName = await this.quickPick("Build configuration to remove ?", Object.keys(uniteConfig.buildConfigurations));
            if (configurationName !== undefined) {
                return this.exec(["unite",
                    "buildConfiguration",
                    `--operation=remove`,
                    `--configurationName=${configurationName}`,
                    `--outputDirectory="${this._uniteJsonLocation}"`
                ], true, true);
            }
        }
    }

    private async commandGenerate(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            const generateType = await this.quickPick("Generate type ?", await this.getGenerateOptions(uniteConfig.applicationFramework));
            if (generateType !== undefined) {
                const name = await this.inputBox("Please enter a human name for your new item ?");
                if (name !== undefined) {
                    return this.exec(["unite",
                        "generate",
                        `--name="${name}"`,
                        `--type=${generateType}`,
                        `--outputDirectory="${this._uniteJsonLocation}"`
                    ], true, true);
                }
            }
        }
    }

    private async commandClientPackageAddProfile(): Promise<void> {
        const profile = await this.quickPick("Client package profile ?", await this.getProfileOptions("clientPackage"));
        if (profile !== undefined) {
            return this.exec(["unite",
                "clientPackage",
                `--operation=add`,
                `--profile=${profile}`,
                `--outputDirectory="${this._uniteJsonLocation}"`
            ], true, true);
        }
    }

    private async commandClientPackageAddOptions(): Promise<void> {
        const packageName = await this.inputBox("Package name ?");
        if (packageName !== undefined) {
            const version = await this.inputBox("Version (leave blank for latest) ?");
            if (version !== undefined) {
                const args = ["unite",
                    "clientPackage",
                    `--operation=add`,
                    `--packageName=${packageName}`
                ];

                if (version.length > 0) {
                    args.push(`--version=${version}`);
                }

                args.push(`--outputDirectory="${this._uniteJsonLocation}"`);

                return this.exec(args, true, true);
            }
        }
    }

    private async commandClientPackageRemove(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            const clientPackage = await this.quickPick("Client package to remove ?", Object.keys(uniteConfig.clientPackages));
            if (clientPackage !== undefined) {
                return this.exec(["unite",
                    "clientPackage",
                    `--operation=remove`,
                    `--packageName=${clientPackage}`,
                    `--outputDirectory="${this._uniteJsonLocation}"`
                ], true, true);
            }
        }
    }

    private async commandPlatformAdd(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            const availablePlatforms = await this.getPipelineOptions("platform");
            const addedPlatforms = Object.keys(uniteConfig.platforms);

            const remaining = availablePlatforms.filter(plat => addedPlatforms.indexOf(plat) < 0);

            if (remaining.length === 0) {
                vscode.window.showErrorMessage("You have already added all the available platforms.");
            } else {
                const platform = await this.quickPick("Platform to add ?", remaining);
                if (platform !== undefined) {
                    return this.exec(["unite",
                        "platform",
                        `--operation=add`,
                        `--platformName=${platform}`,
                        `--outputDirectory="${this._uniteJsonLocation}"`
                    ], true, true);
                }
            }
        }
    }

    private async commandPlatformRemove(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            const platform = await this.quickPick("Platform to remove ?", Object.keys(uniteConfig.platforms));
            if (platform !== undefined) {
                return this.exec(["unite",
                    "platform",
                    `--operation=remove`,
                    `--platformName=${platform}`,
                    `--outputDirectory="${this._uniteJsonLocation}"`
                ], true, true);
            }
        }
    }

    private async commandTaskBuild(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            await this.relocateToPackageJsonFolder(uniteConfig);

            return this.exec(["gulp",
                "build"
            ], false, true);
        }
    }

    private async commandTaskBuildConfiguration(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            const buildConfiguration = await this.quickPick("Build Configuration (leave blank for default) ?", Object.keys(uniteConfig.buildConfigurations));

            if (buildConfiguration !== undefined) {
                const args = ["gulp",
                    "build"
                ];

                if (buildConfiguration.length > 0) {
                    args.push(`--buildConfiguration=${buildConfiguration}`);
                }

                await this.relocateToPackageJsonFolder(uniteConfig);

                return this.exec(args, false, true);
            }
        }
    }

    private async commandTaskBuildWatch(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            await this.relocateToPackageJsonFolder(uniteConfig);

            return this.exec(["gulp",
                "build",
                "--watch"
            ], false, true);
        }
    }

    private async commandTaskThemeBuild(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            await this.relocateToPackageJsonFolder(uniteConfig);

            return this.exec(["gulp",
                "theme-build"
            ], false, true);
        }
    }

    private async commandTaskUnit(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            await this.relocateToPackageJsonFolder(uniteConfig);

            if (uniteConfig.unitTestRunner === "None") {
                vscode.window.showErrorMessage("Your UniteJS configuration does not specify a unit test runner");
            } else {
                return this.exec(["gulp",
                    "unit"
                ], false, true);
            }
        }
    }

    private async commandTaskUnitWatch(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            await this.relocateToPackageJsonFolder(uniteConfig);

            if (uniteConfig.unitTestRunner === "None") {
                vscode.window.showErrorMessage("Your UniteJS configuration does not specify a unit test runner");
            } else {
                return this.exec(["gulp",
                    "unit",
                    "--watch"
                ], false, true);
            }
        }
    }

    private async commandTaskUnitOptions(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.unitTestRunner === "None") {
                vscode.window.showErrorMessage("Your UniteJS configuration does not specify a unit test runner");
            } else {
                const grep = await this.inputBox("Which test to run (leave blank for all) ?");
                if (grep !== undefined) {
                    let browser;

                    if (uniteConfig.unitTestRunner.toLowerCase() == "karma") {
                        browser = await this.quickPick("Which browser to launch (leave blank for headless) ?", ["chrome", "chromeheadless", "edge", "firefox", "ie", "phantomjs", "safari"]);
                    } else {
                        browser = "";
                    }

                    if (browser !== undefined) {
                        const watch = await this.quickPick("Continue to watch ?", await this.getReverseBooleanOptions())
                        if (watch !== undefined) {
                            await this.relocateToPackageJsonFolder(uniteConfig);
                            const args = ["gulp",
                                "unit"
                            ];

                            if (grep.length > 0) {
                                args.push(`--grep=${grep}`);
                            }

                            if (browser.length > 0) {
                                args.push(`--browser=${browser}`);
                            }

                            if (watch === "true") {
                                args.push(`--watch`);
                            }
                            return this.exec(args, false, true);
                        }
                    }
                }
            }
        }
    }

    private async commandTaskUnitSingle(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.unitTestRunner === "None") {
                vscode.window.showErrorMessage("Your UniteJS configuration does not specify a unit test runner");
            } else {
                const grep = await this.inputBox("Which test to run ?");
                if (grep !== undefined) {
                    await this.relocateToPackageJsonFolder(uniteConfig);

                    const args = ["gulp",
                        "unit"
                    ];

                    if (grep.length > 0) {
                        args.push(`--grep=${grep}`);
                    }

                    return this.exec(args, false, true);
                }
            }
        }
    }

    private async commandTaskE2EInstall(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.e2eTestRunner === "None") {
                vscode.window.showErrorMessage("Your UniteJS configuration does not specify a e2e test runner");
            } else {
                await this.relocateToPackageJsonFolder(uniteConfig);
                return this.exec(["gulp",
                    "e2e-install"
                ], false, true);
            };
        }
    }

    private async commandTaskE2EInstallOptions(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.e2eTestRunner === "None") {
                vscode.window.showErrorMessage("Your UniteJS configuration does not specify a e2e test runner");
            } else {
                const drivers = await this.inputBox("Which drivers to install comma separated (chrome/edge/firefox/ie) ?");
                if (drivers !== undefined) {
                    await this.relocateToPackageJsonFolder(uniteConfig);

                    const args = ["gulp",
                        "e2e-install"
                    ];

                    if (drivers.length > 0) {
                        args.push(`--drivers=${drivers}`);
                    }

                    return this.exec(args, false, true);
                }
            }
        }
    }

    private async commandTaskE2E(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.e2eTestRunner === "None") {
                vscode.window.showErrorMessage("Your UniteJS configuration does not specify a e2e test runner");
            } else {
                await this.relocateToPackageJsonFolder(uniteConfig);
                return this.exec(["gulp",
                    "e2e"
                ], false, true);
            }
        }
    }

    private async commandTaskE2ESingle(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.e2eTestRunner === "None") {
                vscode.window.showErrorMessage("Your UniteJS configuration does not specify a e2e test runner");
            } else {
                const grep = await this.inputBox("Which test to run ?");
                if (grep !== undefined) {
                    await this.relocateToPackageJsonFolder(uniteConfig);

                    const args = ["gulp",
                        "e2e"
                    ];

                    if (grep.length > 0) {
                        args.push(`--grep=${grep}`);
                    }

                    return this.exec(args, false, true);
                }
            }
        }
    }

    private async commandTaskE2EOptions(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.e2eTestRunner === "None") {
                vscode.window.showErrorMessage("Your UniteJS configuration does not specify a e2e test runner");
            } else {
                const grep = await this.inputBox("Which test to run ?");
                if (grep !== undefined) {
                    const secure = await this.quickPick("Secure (leave blank for default) ?", await this.getReverseBooleanOptions());
                    if (secure !== undefined) {
                        const port = await this.inputBox("Port (leave blank for default) ?");
                        if (port !== undefined) {
                            const browser = await this.quickPick("Which browser to launch (leave blank for chrome headless) ?", ["chrome", "edge", "firefox", "ie"]);
                            if (browser !== undefined) {
                                await this.relocateToPackageJsonFolder(uniteConfig);

                                const args = ["gulp",
                                    "e2e"
                                ];

                                if (grep.length > 0) {
                                    args.push(`--grep=${grep}`);
                                }

                                if (secure === "true") {
                                    args.push(`--secure`);
                                }

                                if (port.length > 0) {
                                    args.push(`--port=${port}`);
                                }

                                if (browser.length > 0) {
                                    args.push(`--browser=${browser}`);
                                }
                                return this.exec(args, false, true);
                            }
                        }
                    }
                }
            }
        }
    }

    private async commandTaskServe(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            await this.relocateToPackageJsonFolder(uniteConfig);

            return this.exec(["gulp",
                "serve"
            ], false, true);
        }
    }

    private async commandTaskServeOptions(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            const secure = await this.quickPick("Secure (leave blank for default) ?", await this.getReverseBooleanOptions());
            if (secure !== undefined) {
                const port = await this.inputBox("Port (leave blank for default) ?");
                if (port !== undefined) {
                    await this.relocateToPackageJsonFolder(uniteConfig);

                    const args = ["gulp",
                        "serve"
                    ];

                    if (secure === "true") {
                        args.push(`--secure`);
                    }

                    if (port.length > 0) {
                        args.push(`--port=${port}`);
                    }

                    return this.exec(args, false, true);
                }
            }
        }
    }

    private async commandTaskPlatformCordovaDev(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Cordova) {
                await this.relocateToPackageJsonFolder(uniteConfig);
                return this.exec(["gulp",
                    "platform-cordova-dev"
                ], false, true);
            } else {
                vscode.window.showErrorMessage("You need to add Cordova as a platform before you can run this task.");
            }
        }
    }

    private async commandTaskPlatformCordovaDevOptions(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Cordova) {
                const platforms = await this.inputBox("Platforms comma separated (leave blank for default) ?");
                if (platforms !== undefined) {
                    const save = await this.quickPick("Save as defaults ?", await this.getBooleanOptions());
                    if (save !== undefined) {
                        await this.relocateToPackageJsonFolder(uniteConfig);

                        const args = ["gulp",
                            "platform-cordova-dev"
                        ];

                        if (platforms.length > 0) {
                            args.push(`--platforms=${platforms}`);
                        }

                        if (save === "true") {
                            args.push(`--save`);
                        }

                        return this.exec(args, false, true);
                    }
                }
            } else {
                vscode.window.showErrorMessage("You need to add Cordova as a platform before you can run this task.");
            }
        }
    }

    private async commandTaskPlatformCordovaTheme(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Cordova) {
                await this.relocateToPackageJsonFolder(uniteConfig);
                return this.exec(["gulp",
                    "platform-cordova-theme"
                ], false, true);
            } else {
                vscode.window.showErrorMessage("You need to add Cordova as a platform before you can run this task.");
            }
        }
    }

    private async commandTaskPlatformCordovaThemeOptions(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Cordova) {
                const platforms = await this.inputBox("Platforms comma separated (leave blank for default) ?");
                if (platforms !== undefined) {
                    await this.relocateToPackageJsonFolder(uniteConfig);

                    const args = ["gulp",
                        "platform-cordova-theme"
                    ];

                    if (platforms.length > 0) {
                        args.push(`--platforms=${platforms}`);
                    }

                    return this.exec(args, false, true);
                }
            } else {
                vscode.window.showErrorMessage("You need to add Cordova as a platform before you can run this task.");
            }
        }
    }

    private async commandTaskPlatformElectronDev(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Electron) {
                await this.relocateToPackageJsonFolder(uniteConfig);
                return this.exec(["gulp",
                    "platform-electron-dev"
                ], false, true);
            } else {
                vscode.window.showErrorMessage("You need to add Electron as a platform before you can run this task.");
            }
        }
    }

    private async commandTaskPlatformElectronDevOptions(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();
        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Electron) {
                const runtimeVersion = await this.inputBox("Runtime Version (leave blank for default) ?");
                if (runtimeVersion !== undefined) {
                    const platformArch = await this.inputBox("Platform Architectures e.g. win32/ia32,win32/x64 (leave blank for default) ?");
                    if (platformArch !== undefined) {
                        const save = await this.quickPick("Save as defaults ?", await this.getBooleanOptions());
                        if (save !== undefined) {
                            await this.relocateToPackageJsonFolder(uniteConfig);

                            const args = ["gulp",
                                "platform-electron-dev"
                            ];

                            if (runtimeVersion.length > 0) {
                                args.push(`--runtimeVersion=${runtimeVersion}`);
                            }

                            if (platformArch.length > 0) {
                                args.push(`--platformArch=${platformArch}`);
                            }

                            if (save === "true") {
                                args.push(`--save`);
                            }

                            return this.exec(args, false, true);
                        }
                    }
                }
            } else {
                vscode.window.showErrorMessage("You need to add Electron as a platform before you can run this task.");
            }
        }
    }

    private async commandTaskPlatformElectronPackage(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Electron) {
                await this.relocateToPackageJsonFolder(uniteConfig);
                return this.exec(["gulp",
                    "platform-electron-package"
                ], false, true);
            } else {
                vscode.window.showErrorMessage("You need to add Electron as a platform before you can run this task.");
            }
        }
    }

    private async commandTaskPlatformElectronPackageOptions(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Electron) {
                const runtimeVersion = await this.inputBox("Runtime Version (leave blank for default) ?");

                if (runtimeVersion !== undefined) {
                    const platformArch = await this.inputBox("Platform Architectures e.g. win32/ia32,win32/x64 (leave blank for default) ?");

                    if (platformArch !== undefined) {
                        const save = await this.quickPick("Save as defaults ?", await this.getBooleanOptions());
                        if (save !== undefined) {
                            await this.relocateToPackageJsonFolder(uniteConfig);

                            const args = ["gulp",
                                "platform-electron-package"
                            ];

                            if (runtimeVersion.length > 0) {
                                args.push(`--runtimeVersion=${runtimeVersion}`);
                            }

                            if (platformArch.length > 0) {
                                args.push(`--platformArch=${platformArch}`);
                            }

                            if (save === "true") {
                                args.push(`--save`);
                            }

                            return this.exec(args, false, true);
                        }
                    }
                }
            } else {
                vscode.window.showErrorMessage("You need to add Electron as a platform before you can run this task.");
            }
        }
    }

    private async commandTaskPlatformDockerPackage(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Docker) {
                await this.relocateToPackageJsonFolder(uniteConfig);
                return this.exec(["gulp",
                    "platform-docker-package"
                ], false, true);
            } else {
                vscode.window.showErrorMessage("You need to add Docker as a platform before you can run this task.");
            }
        }
    }

    private async commandTaskPlatformDockerPackageOptions(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Docker) {
                const image = await this.inputBox("Image (leave blank for default) ?");

                if (image !== undefined) {
                    const www = await this.inputBox("www folder location in image (leave blank for default) ?");

                    if (www !== undefined) {
                        const save = await this.quickPick("Save as defaults ?", await this.getBooleanOptions());
                        if (save !== undefined) {
                            await this.relocateToPackageJsonFolder(uniteConfig);

                            const args = ["gulp",
                                "platform-docker-package"
                            ];

                            if (image.length > 0) {
                                args.push(`--image=${image}`);
                            }

                            if (www.length > 0) {
                                args.push(`--www=${www}`);
                            }

                            if (save === "true") {
                                args.push(`--save`);
                            }

                            return this.exec(args, false, true);
                        }
                    }
                }
            } else {
                vscode.window.showErrorMessage("You need to add Docker as a platform before you can run this task.");
            }
        }
    }

    private async commandTaskPlatformWebPackage(): Promise<void> {
        const uniteConfig = await this.loadConfiguration();

        if (uniteConfig) {
            if (uniteConfig.platforms && uniteConfig.platforms.Web) {
                await this.relocateToPackageJsonFolder(uniteConfig);
                return this.exec(["gulp",
                    "platform-web-package"
                ], false, true);
            } else {
                vscode.window.showErrorMessage("You need to add Web as a platform before you can run this task.");
            }
        }
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
