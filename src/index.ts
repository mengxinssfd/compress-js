import babel from "@rollup/plugin-babel";
import {terser} from "rollup-plugin-terser";
import {minify} from "uglify-js";
import {Plugin, ModuleFormat} from "rollup";
import {useDateFormat} from "./utils";
const {uglify} = require("rollup-plugin-uglify");
const resolve = require("rollup-plugin-node-resolve");
const rollup = require("rollup");
const Path = require("path");
const Fs = require("fs");

type Option = {
    input: string;
    output?: string;
    libraryName?: string;
    terser?: boolean;
    babel?: boolean;
    uglify?: boolean;
    dropConsole?: boolean;
    dropDebugger?: boolean;
    module?: ModuleFormat;
    eval?: boolean;
}
useDateFormat();
export default async function bundleStart(option: Option) {
    if (!option.input || !Fs.existsSync(option.input)) {
        throw new Error(`entry: ${option.input} is not exists`);
    }
    const fileDir = Path.dirname(option.input);
    const babelRcPathTo = Path.resolve(fileDir, ".babelrc");
    // 默认输出文件名为输入文件名.min.js
    if (!option.output) {
        option.output = Path.resolve(fileDir, Path.basename(option.input, Path.extname(option.input)) + ".min.js");
        console.log("default output path: ", option.output);
    }
    const isExistBabelRc = Fs.existsSync(babelRcPathTo);

    // libraryName默认为入口文件名
    if (!option.libraryName) {
        option.libraryName = Path.basename(option.input).split(".")[0];
    }

    const plugins: Plugin[] = [];
    try {
        const isTs = Path.extname(option.input) === ".ts";
        // ts
        if (isTs) {
            const typescript = require("rollup-plugin-typescript2");
            plugins.push(typescript({
                // tsconfig:"tsconfig.webpack.json",
                tsconfigOverride: {
                    compilerOptions: {
                        declaration: false, // 输出时去除类型文件
                        module: "ESNext",
                        target: "ES6"
                    }
                }
            }));
        }

        // babel
        if (option.babel) {
            plugins.push(resolve());
            const extensions = [".js"];
            if (isTs) {
                extensions.push("ts");
            }
            plugins.push(babel({
                extensions,
                exclude: "node_modules/*",
                babelHelpers: "bundled"
            }));

            if (!isExistBabelRc) {
                const envPath = Path.resolve(__dirname, "../node_modules/@babel/preset-env");
                // console.log("env path: ", envPath);
                const tpl = `{"presets": [["${envPath}", {"modules": false, "loose": true}]]}`;
                Fs.writeFileSync(babelRcPathTo, tpl.replace(/\\/g, "/"));
            }
        }
        // 压缩
        if (option.terser) {
            plugins.push(terser());
        }

        // uglify-js 包含terser和部分babel的效果
        if (option.uglify) {
            plugins.push(uglify({
                compress: {
                    drop_console: option.dropConsole,
                    drop_debugger: option.dropDebugger
                }
            }, minify));
        }
        const date = new Date();
        const banner =
            "/*!\n" +
            ` * ${option.libraryName}\n` +
            ` * Date: ${date.format("yyyy-MM-dd hh:mm")}\n` +
            ` */\n`;

        if (option.eval) {
            // plugin顺序是从0开始到最后
            plugins.push({
                name: "",
                renderChunk(code) {
                    const packer = require("../packer");
                    return banner + packer.pack(code, true);
                }
            });
        }

        const rs = await rollup.rollup({
            input: option.input,  // 入口文件
            plugins
        });
        /*const {output: outputs} = */

        await rs.write({
            name: option.libraryName!, // umd 模式必须要有 name  此属性作为全局变量访问打包结果
            file: option.output!,
            banner,
            format: typeof option.module === "string" ? option.module : "umd",
            sourcemap: false
        });
        // console.log(outputs[0].code);
    } finally {
        if (option.babel && !isExistBabelRc) {
            Fs.rmSync(babelRcPathTo);
        }
    }
}