"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const chalk = require("chalk");
const File_1 = __importDefault(require("../../common/File"));
// import chokidar from 'chokidar';
const getDefaults_1 = __importDefault(require("./getDefaults"));
const TYPES = ['library', 'app', 'html5', 'fullstack', 'component', 'block', 'template', 'repository'];
function getConfig(cwd, configPath, packagePath) {
    delete require.cache[configPath];
    delete require.cache[packagePath];
    if (fs.existsSync(configPath))
        return require(configPath);
    else if (fs.existsSync(packagePath)) {
        const packageVusion = require(packagePath).vusion;
        if (packageVusion)
            return packageVusion;
        else {
            throw new Error(chalk.bgRed(' ERROR ') + ` Cannot find vusion config! This is not a vusion project.
    processCwd: ${cwd}
    configPath: ${configPath}
`);
        }
    }
}
function resolve(cwd, configPath = 'vusion.config.js', args, throwErrors) {
    cwd = cwd || process.cwd();
    const config = getDefaults_1.default();
    const packagePath = config.packagePath = path.resolve(cwd, 'package.json');
    configPath = config.configPath = path.resolve(cwd, configPath);
    const userConfig = getConfig(cwd, configPath, packagePath);
    // 覆盖一些默认配置
    if (userConfig.type === 'library') {
        config.publicPath = './';
        config.outputPath = 'dist';
    }
    Object.assign(config, userConfig);
    if (!TYPES.includes(config.type)) {
        throw new Error(chalk.bgRed(' ERROR ') + ' Unknown project type!');
    }
    /**
     * CLI Arguments
     */
    if (args) {
        if (args['vusion-mode'])
            config.mode = args['vusion-mode'];
        if (args.theme)
            config.theme = args.theme;
        if (args['apply-theme'] !== undefined)
            config.applyTheme = !!args['apply-theme'];
        if (args['base-css'])
            config.baseCSSPath = path.resolve(cwd, args['base-css']);
        if (args['output-path'])
            config.outputPath = path.resolve(cwd, args['output-path']);
        if (args['public-path'])
            config.publicPath = path.resolve(cwd, args['public-path']);
        if (args['src-path'])
            config.srcPath = path.resolve(cwd, args['src-path']);
        if (args['library-path'])
            config.libraryPath = path.resolve(cwd, args['library-path']);
    }
    config.srcPath = path.resolve(cwd, config.srcPath || './src');
    config.libraryPath = path.resolve(cwd, config.libraryPath || config.srcPath);
    if (config.type === 'library') {
        config.docs = config.docs || {};
    }
    else if (config.type === 'component' || config.type === 'block') {
        config.srcPath = cwd;
        const pkg = new File_1.default(packagePath).loadJSON();
        let libraryName = pkg.vusion.ui;
        if (!libraryName && pkg.peerDependencies)
            libraryName = Object.keys(pkg.peerDependencies).find((key) => key.endsWith('.vusion'));
        if (!libraryName)
            libraryName = 'cloud-ui.vusion';
        config.libraryPath = path.dirname(require.resolve(`${libraryName}/src`));
    }
    let themeAutoDetected = false;
    if (!config.theme) {
        themeAutoDetected = true;
        config.theme = {
            default: path.resolve(config.libraryPath, './styles/theme.css'),
        };
    }
    if (typeof config.theme === 'string') {
        config.theme = config.theme.split(',');
    }
    if (Array.isArray(config.theme)) {
        const theme = {};
        config.theme.forEach((_theme) => {
            if (_theme.endsWith('.css')) { // is a path
                let name = path.basename(_theme, '.css');
                if (name === 'theme')
                    name = 'default';
                theme[name] = path.resolve(cwd, _theme);
            }
            else { // is a name
                if (_theme === 'default' || _theme === 'theme')
                    theme['default'] = path.resolve(config.libraryPath, './styles/theme.css');
                else
                    theme[_theme] = path.resolve(cwd, `./themes/${_theme}.css`);
            }
        });
        config.theme = theme;
    }
    // else Object
    if (themeAutoDetected) {
        // @compat old version
        if (!fs.existsSync(config.theme.default))
            config.theme.default = path.resolve(config.libraryPath, './base/global.css');
        if (!fs.existsSync(config.theme.default)) {
            try {
                config.theme.default = path.resolve(require.resolve('@vusion/doc-loader'), '../node_modules/proto-ui.vusion/src/styles/theme.css');
            }
            catch (e) {
                // not work
            }
        }
    }
    let baseCSSPath; // 用于保存非文档的 baseCSSPath 路径
    if (!config.baseCSSPath) {
        baseCSSPath = config.baseCSSPath = path.resolve(config.libraryPath, './styles/base.css');
        // @compat old version
        if (!fs.existsSync(config.baseCSSPath))
            baseCSSPath = config.baseCSSPath = path.resolve(config.libraryPath, './base/base.css');
        if (!fs.existsSync(config.baseCSSPath)) {
            try {
                config.baseCSSPath = path.resolve(require.resolve('@vusion/doc-loader'), '../node_modules/proto-ui.vusion/src/styles/base.css');
            }
            catch (e) {
                // not work
            }
        }
    }
    else
        config.baseCSSPath = baseCSSPath = path.resolve(cwd, config.baseCSSPath);
    if (!fs.existsSync(config.baseCSSPath) && throwErrors)
        throw new Error(`Cannot find baseCSSPath: ${baseCSSPath}`);
    if (config.designer) {
        config.designer = Object.assign({
            protocol: 'http',
            host: 'localhost',
            port: 12800,
        }, config.designer);
    }
    {
        const pkg = new File_1.default(packagePath).loadJSON();
        config.ui.name = pkg.ui.name;
        config.ui.version = pkg.ui.version;
    }
    return config;
}
exports.default = resolve;
