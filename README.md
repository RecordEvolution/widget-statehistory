# \<widget-linechart>

This webcomponent follows the [open-wc](https://github.com/open-wc/open-wc) recommendation.

## Installation

```bash
npm i widget-linechart
```

## Usage

```html
<script type="module">
    import 'widget-linechart/widget-linechart.js'
</script>

<widget-linechart></widget-linechart>
```

## Expected data format

Please take a look at the src/default-data.json to see what data is expected to make the widget show content.

## Interfaces

## Style options

The following options are available for styling the overall graph and individual lines as well as the graph legend.

The `SeriesOptions` type can either be `line` or `dots`. This selection affects the following styling options.

```
  interface Point {
    radius: number,
    pointStyle: 'circle' | 'cross' | 'crossRot' | 'dash' | 'line' | 'rect' | 'rectRounded' | 'rectRot' | 'star' | 'triangle' | false,
    backgroundColor: string,
    borderColor: string,
    borderWidth: number
  }


  interface Line {
    backgroundColor: string,
    borderColor: string,
    borderWidth: number,
    fill: boolean,
  }
```

## Tooling configs

For most of the tools, the configuration is in the `package.json` to reduce the amount of files in your project.

If you customize the configuration a lot, you can consider moving them to individual files.

## Local Demo with `web-dev-server`

```bash
npm start
```

To run a local development server that serves the basic demo located in `demo/index.html`
