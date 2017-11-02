# UniteJS VSCode Extension

This extension provides access to all of the UniteJS CLI commands as well as the build tasks for the generated application.

All of the commands will operate on whichever folder VSCode is opened in, the output from all the commands is displayed in a terminal labelled Unite.

For more information on UniteJS visit the [Web Site](http://unitejs.com/).

## UniteJS CLI Commands Mapping

See [UniteJS CLI](http://unitejs.com/#/cli) documentation for more details.

| VSCode Command                         | Terminal Command                            | Comments / Prompts for            |
|----------------------------------------|---------------------------------------------|-----------------------------------|
| Unite: version                         | unite version                               |                                   |
| Unite: help                            | unite help                                  |                                   |
| Unite: configure profile               | unite configure                             | profile, packageName, title       |
| Unite: configure options               | unite configure                             | packageName, title, license       |
|                                        |                                             | appFramwork, sourceLanguage       |
|                                        |                                             | linter, moduleType, bundler       |
|                                        |                                             | unitTestRunner, unitTestFramework |
|                                        |                                             | unitTestEngine, e2eTestRunner     |
|                                        |                                             | e2eTestFramework, cssPre, cssPost |
|                                        |                                             | packageManager                    |
| Unite: configure options no exec       | unite configure                             | as above but will only populate   |
|                                        |                                             | terminal command, not execute it  |
| Unite: configure update                | unite configure                             | no arguments only performs update |
| Unite: install packages                | npm install / yarn install                  | depends on chosen package manager |
| Unite: buildConfiguration add          | unite buildConfiguration --operation=add    | configurationName, bundle, minify |
|                                        |                                             | sourcemaps, pwa                   |
| Unite: buildConfiguration remove       | unite buildConfiguration --operation=remove | configurationName                 |
| Unite: generate                        | unite generate                              | name, type                        |
| Unite: clientPackage add profile       | unite clientPackage --operation=add         | profile                           |
| Unite: clientPackage add options       | unite clientPackage --operation=add         | packageName, version              |
| Unite: clientPackage remove            | unite clientPackage --operation=remove      | packageName                       |
| Unite: platform add                    | unite platform --operation=add              | platformName                      |
| Unite: platform remove                 | unite platform --operation=remove           | platformName                      |

## UniteJS Tasks Mapping

See [UniteJS Generated App](http://unitejs.com/#/generatedapp) documentation for more details.

| VSCode Command                                | Terminal Command                            | Comments / Prompts for             |
|-----------------------------------------------|---------------------------------------------|------------------------------------|
| Unite: task build                             | gulp build                                  |                                    |
| Unite: task build watch                       | gulp build --watch                          |                                    |
| Unite: task build configuration               | gulp build                                  | buildConfiguration                 |
| Unite: task theme build                       | gulp theme-build                            |                                    |
| Unite: task unit                              | gulp unit                                   |                                    |
| Unite: task unit watch                        | gulp unit                                   |                                    |
| Unite: task unit single                       | gulp unit                                   | grep                               |
| Unite: task unit options                      | gulp unit                                   | grep, browser, watch               |
| Unite: task e2e install                       | gulp e2e-install                            |                                    |
| Unite: task e2e                               | gulp e2e                                    |                                    |
| Unite: task e2e single                        | gulp e2e                                    | grep                               |
| Unite: task e2e options                       | gulp e2e                                    | grep, secure, port, browser        |
| Unite: task serve                             | gulp serve                                  |                                    |
| Unite: task serve options                     | gulp serve                                  | secure, port                       |
| Unite: task platform docker package           | gulp platform-docker-package                |                                    |
| Unite: task platform docker package options   | gulp platform-docker-package                | image, www, save                   |
| Unite: task platform electron dev             | gulp platform-electron-dev                  |                                    |
| Unite: task platform electron dev options     | gulp platform-electron-dev                  | runtimeVersion, platformArch, save |
| Unite: task platform electron package         | gulp platform-electron-package              |                                    |
| Unite: task platform electron package options | gulp platform-electron-package              | runtimeVersion, platformArch, save |
| Unite: task platform web package              | gulp platform-web-package                   |                                    |

&copy; 2017 Obany Ltd