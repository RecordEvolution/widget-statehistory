import replace from '@rollup/plugin-replace'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'
import babel from '@rollup/plugin-babel'
import { readFileSync } from 'fs'
const npmPackage = JSON.parse(readFileSync('./package.json'))

export default {
    // if you use createSpaConfig, you can use your index.html as entrypoint,
    // any <script type="module"> inside will be bundled by rollup
    input: ['./src/widget-statehistory.ts'],
    treeshake: {
        moduleSideEffects: false
    },
    output: {
        dir: './dist',
        sourcemap: true,
        name: 'widget-statehistory-bundle',
        banner: `/* @license Copyright (c) 2023 Record Evolution GmbH. All rights reserved.*/`,
        format: 'esm'
    },
    plugins: [
        replace({
            'process.env.NODE_ENV': JSON.stringify('production'),
            versionplaceholder: npmPackage.version,
            preventAssignment: true
        }),
        typescript({ sourceMap: true }),
        nodeResolve(),
        commonjs({}),
        babel({ babelHelpers: 'bundled' })
    ]

    // alternatively, you can use your JS as entrypoint for rollup and
    // optionally set a HTML template manually
    // input: './app.js',
}
