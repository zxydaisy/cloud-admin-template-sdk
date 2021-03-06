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
const chalk = require("chalk");
const path = __importStar(require("path"));
const actions_1 = __importDefault(require("./actions"));
const pages_1 = __importDefault(require("./pages"));
function default_1(plop) {
    const dest = plop.getDestBasePath();
    return {
        prompts: [
            {
                type: 'input',
                name: 'name',
                required: true,
                message: '请输入入口页名称（如"register"，将作为文件夹名、路径名等使用）',
                validate(value) {
                    if (value) {
                        return true;
                    }
                    return '入口页名称必填';
                },
            },
            {
                type: 'input',
                name: 'title',
                message: '请输入入口页标题（可选，如"用户注册"，作为网页 title 等使用）',
            },
            {
                type: 'confirm',
                name: 'auth',
                default: true,
                message: '是否需要登录验证（默认为 true）',
            },
            {
                type: 'confirm',
                name: 'isIndex',
                message: '是否设置为首页（默认为 false）',
                default: false,
                when() {
                    return !pages_1.default.get(dest).index;
                }
            },
        ],
        actions(answers) {
            const { name } = answers;
            answers.appName = require(path.join(dest, 'package.json')).name.replace(/-client$/, '');
            return [
                ...actions_1.default.add(answers, dest),
                [
                    `入口页面 ${chalk.blue(name)} 已经添加成功。你需要${chalk.green(`重新启动 dev server`)}，然后打开 ${chalk.blue(`/${name}`)} 即可查看。`,
                    `需要注意以下几点：`,
                    `  入口 JS 文件为 ${chalk.yellow(`src/views/${name}/index.js`)}`,
                    `  入口页面模板为 ${chalk.yellow(`src/pages/${name}.html`)}`,
                    `  Webpack 配置 (vue pages 配置) 在 ${chalk.yellow(`pages.json`)} 中`,
                    `  代理在 ${chalk.yellow('webpack.dev-server.js')} 中，可能需要修改`,
                ].join('\n'),
            ];
        },
    };
}
exports.default = default_1;
