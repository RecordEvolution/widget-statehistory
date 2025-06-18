import { html, css, LitElement, PropertyValueMap } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import * as echarts from 'echarts/core'
import {
    TitleComponent,
    ToolboxComponent,
    TooltipComponent,
    LegendComponent,
    DataZoomComponent,
    GridComponent
} from 'echarts/components'
import { LineChart, BarChart, ScatterChart } from 'echarts/charts'
import { UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import tinycolor, { ColorInput } from 'tinycolor2'

echarts.use([
    GridComponent,
    TitleComponent,
    ToolboxComponent,
    TooltipComponent,
    LegendComponent,
    DataZoomComponent,
    LineChart,
    BarChart,
    ScatterChart,
    CanvasRenderer,
    UniversalTransition
])

import { InputData } from './definition-schema'
import { EChartsOption, SeriesOption } from 'echarts'
import { TitleOption } from 'echarts/types/dist/shared'

type Theme = {
    theme_name: string
    theme_object: any
}
@customElement('widget-linechart-versionplaceholder')
export class WidgetLinechart extends LitElement {
    @property({ type: Object })
    inputData?: InputData

    @property({ type: Object })
    theme?: Theme

    @state()
    private canvasList: Map<
        string,
        { echart?: echarts.ECharts; series: SeriesOption[]; doomed?: boolean; element?: HTMLDivElement }
    > = new Map()

    @state() private themeBgColor?: string
    @state() private themeTitleColor?: string
    @state() private themeSubtitleColor?: string

    boxes?: HTMLDivElement[]
    origWidth: number = 0
    origHeight: number = 0
    template: EChartsOption
    modifier: number = 1
    version: string = 'versionplaceholder'
    chartContainer: HTMLDivElement | null | undefined
    resizeObserver?: ResizeObserver

    constructor() {
        super()

        this.template = {
            title: {
                text: 'Temperature Change in the Coming Week',
                left: 20,
                textStyle: {
                    fontSize: 14
                }
            } as TitleOption,
            tooltip: {
                trigger: 'axis'
            },
            legend: {
                right: '10%',
                top: 0
            },
            grid: {
                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                top: 30,
                bottom: 20,
                left: 20,
                right: 10,
                containLabel: true // ensures labels are not cut off
            },
            toolbox: {
                show: true,
                feature: {
                    // dataZoom: {
                    //     yAxisIndex: 'none'
                    // },
                    // dataView: { readOnly: false },
                    restore: {}
                    // saveAsImage: {}
                }
            },
            dataZoom: [
                {
                    show: false,
                    realtime: true,
                    // start: 30,
                    // end: 70,
                    xAxisIndex: [0, 1]
                }
            ],
            xAxis: {
                type: 'value', // value, time, log, category
                name: 'Time',
                nameGap: 27,
                nameLocation: 'middle',
                axisLine: {
                    lineStyle: {
                        width: undefined
                    }
                },
                axisLabel: {
                    fontSize: 14
                }
            },
            yAxis: {
                type: 'value',
                nameLocation: 'middle',
                name: 'Temperature (°C)',
                nameGap: 30,
                axisLabel: {
                    fontSize: 14
                },
                axisLine: {
                    lineStyle: {
                        width: undefined
                    }
                },
                scale: false
            },
            series: [
                {
                    name: 'Highest',
                    type: 'line',
                    symbolSize: 8,
                    lineStyle: {
                        width: 2,
                        type: 'solid',
                        color: 'green'
                    },
                    data: [10, 11, 13, 11, 12, 12, 9]
                } as SeriesOption,
                {
                    name: 'Lowest',
                    type: 'line',
                    symbolSize: 8,
                    lineStyle: {
                        width: 2,
                        type: 'solid'
                    },
                    data: [1, -2, 2, 5, 3, 2, 0]
                } as SeriesOption
            ]
        } as EChartsOption
    }

    update(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        if (changedProperties.has('inputData') && this.chartContainer) {
            this.transformData()
            this.applyData()
        }

        if (changedProperties.has('theme')) {
            this.registerTheme(this.theme)
            this.deleteCharts()
            this.transformData()
            this.applyData()
        }
        super.update(changedProperties)
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        this.chartContainer = this.shadowRoot?.querySelector('.chart-container')
        this.transformData()
        this.applyData()
        this.registerTheme(this.theme)
        // Add ResizeObserver for chart container
        if (this.chartContainer) {
            this.resizeObserver = new ResizeObserver(() => {
                this.canvasList.forEach((chart) => {
                    chart.echart?.resize()
                })
            })
            this.resizeObserver.observe(this.chartContainer)
        }
    }

    registerTheme(theme?: Theme) {
        const cssTextColor = getComputedStyle(this).getPropertyValue('--re-text-color').trim()
        const cssBgColor = getComputedStyle(this).getPropertyValue('--re-background-color').trim()
        this.themeBgColor = cssBgColor || this.theme?.theme_object?.backgroundColor
        this.themeTitleColor = cssTextColor || this.theme?.theme_object?.title?.textStyle?.color
        this.themeSubtitleColor =
            cssTextColor || this.theme?.theme_object?.title?.subtextStyle?.color || this.themeTitleColor

        if (!theme || !theme.theme_object || !theme.theme_name) return

        echarts.registerTheme(theme.theme_name, theme.theme_object)
    }

    transformData() {
        if (!this?.inputData?.dataseries?.length) return

        // reset all existing chart dataseries
        this.canvasList.forEach((chartM) => {
            chartM.series = []
            chartM.doomed = true
        })
        this.inputData.dataseries.sort((a, b) => (a.advanced?.drawOrder ?? 0) - (b.advanced?.drawOrder ?? 0))
        this.inputData.dataseries.forEach((ds) => {
            ds.advanced ??= {}
            ds.advanced.chartName ??= ''

            ds.data ??= []

            // pivot data
            const distincts = [...new Set(ds.data.map((d) => d.pivot))].sort()
            const derivedBgColors = tinycolor(ds.backgroundColor as ColorInput | undefined)
                .monochromatic(distincts.length)
                .map((c: any) => c.toHexString())
            const derivedBdColors = tinycolor(ds.borderColor as ColorInput | undefined)
                .monochromatic(distincts.length)
                .map((c: any) => c.toHexString())
            //sd
            distincts.forEach((piv, i) => {
                const prefix = piv ?? ''
                const label = ds.label ?? ''
                const name = prefix + (!!prefix && !!label ? ' - ' : '') + label
                const lineColor = ds.borderColor
                    ? ds.advanced?.chartName?.includes('#split#')
                        ? ds.borderColor
                        : derivedBdColors[i]
                    : undefined
                const fillColor = ds.backgroundColor
                    ? ds.advanced?.chartName?.includes('#split#')
                        ? ds.backgroundColor
                        : derivedBgColors[i]
                    : undefined
                const data = distincts.length === 1 ? ds.data : ds.data?.filter((d) => d.pivot === piv)
                const data2 = this.inputData?.axis?.timeseries
                    ? data?.map((d) => [new Date(d.x ?? ''), d.y, d.r])
                    : data?.map((d) => [d.x, d.y, d.r])

                // preparing the echarts series option for later application
                const pds: SeriesOption = {
                    name: name,
                    type: ds.type ?? 'line',
                    lineStyle: {
                        color: lineColor,
                        width: ds.styling?.borderWidth ?? 2,
                        type: ds.styling?.borderDash ?? 'solid'
                    },
                    itemStyle: {
                        color: fillColor,
                        borderColor: lineColor,
                        borderWidth: ds.styling?.borderWidth ?? 2
                    },
                    areaStyle: ds.styling?.fill ? { color: fillColor } : undefined,
                    symbol: ds.styling?.pointStyle ?? 'circle',
                    symbolSize: (data) => data[2] ?? 4,
                    showSymbol: ds.styling?.pointStyle === 'none' ? false : true,
                    data: data2 ?? []
                }
                let chartName = ds.advanced?.chartName ?? ''
                chartName = chartName.replace('#split#', prefix)

                const chart = this.setupChart(chartName)
                chart?.series.push(pds)
            })
        })

        const doomedCharts: string[] = []
        // remove all doomed charts
        this.canvasList.forEach((chart, label) => {
            if (!chart.doomed) return
            chart.echart?.dispose()
            chart.element?.remove()
            doomedCharts.push(label)
        })

        doomedCharts.forEach((label) => this.canvasList.delete(label))
    }

    xAxisType(): 'value' | 'log' | 'category' | 'time' | undefined {
        if (this.inputData?.axis?.timeseries) return 'time'
        const onePoint = this.inputData?.dataseries?.[0]?.data?.[0]
        if (!isNaN(Number(onePoint?.x))) return 'value'
        return 'category'
    }

    yAxisType(): 'value' | 'log' | 'category' | undefined {
        const onePoint = this.inputData?.dataseries?.[0]?.data?.[0]
        if (!isNaN(Number(onePoint?.y))) return 'value'
        return 'category'
    }

    applyData() {
        const modifier = 1

        this.canvasList.forEach((chart, label) => {
            chart.series.sort((a, b) => ((a.name as string) > (b.name as string) ? 1 : -1))
            this.requestUpdate()

            const option: any = window.structuredClone(this.template)
            // Title
            option.title.text = label
            // option.title.textStyle.fontSize = 25 * modifier

            // Axis
            option.xAxis.name = this.inputData?.axis?.xAxisLabel ?? ''
            option.dataZoom[0].show = this.inputData?.axis?.xAxisZoom ?? false
            option.toolbox.show = this.inputData?.axis?.xAxisZoom ?? false
            // option.xAxis.axisLine.lineStyle.width = 2 * modifier
            // option.xAxis.axisLabel.fontSize = 20 * modifier
            option.xAxis.type = this.xAxisType()
            option.yAxis.type = this.yAxisType()

            option.yAxis.name = this.inputData?.axis?.yAxisLabel ?? ''
            // option.yAxis.axisLine.lineStyle.width = 2 * modifier
            // option.yAxis.axisLabel.fontSize = 20 * modifier
            option.yAxis.scale = this.inputData?.axis?.yAxisScaling ?? false

            option.series = chart.series
            // console.log('Applying data to chart', label, option)
            if (chart.series.length <= 1) option.legend.show = false
            const oldOption: any = chart.echart?.getOption() ?? {}
            const notMerge = oldOption.series?.length !== chart.series.length
            chart.echart?.setOption(option, { notMerge })
            // chart.echart?.resize()
        })
    }

    deleteCharts() {
        this.canvasList.forEach((chart, label) => {
            chart.echart?.dispose()
            chart.element?.remove()
            this.canvasList.delete(label)
        })
    }

    setupChart(label: string) {
        const existingChart = this.canvasList.get(label)

        if (existingChart) {
            delete existingChart.doomed
            return existingChart
        }

        if (!this.chartContainer) {
            console.warn('Chart container not found')
            return
        }
        const newContainer = document.createElement('div')
        newContainer.setAttribute('name', label)
        newContainer.setAttribute('class', 'sizer')
        this.chartContainer.appendChild(newContainer)

        const newChart = echarts.init(newContainer, this.theme?.theme_name)
        const chart = { echart: newChart, series: [] as SeriesOption[], element: newContainer }
        this.canvasList.set(label, chart)

        return chart
    }

    disconnectedCallback() {
        if (this.resizeObserver && this.chartContainer) {
            this.resizeObserver.unobserve(this.chartContainer)
            this.resizeObserver.disconnect()
        }
        super.disconnectedCallback()
    }

    static styles = css`
        :host {
            display: block;
            font-family: sans-serif;
            box-sizing: border-box;
            position: relative;
            margin: auto;
        }

        .paging:not([active]) {
            display: none !important;
        }

        .wrapper {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            padding: 16px;
            box-sizing: border-box;
            gap: 12px;
        }

        .sizer {
            flex: 1;
            overflow: hidden;
            position: relative;
        }

        .chart-container {
            display: flex;
            flex: 1;
            overflow: hidden;
            position: relative;
        }

        header {
            display: flex;
            flex-direction: column;
        }
        h3 {
            margin: 0;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        p {
            margin: 10px 0 0 0;
            max-width: 300px;
            font-size: 14px;
            line-height: 17px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .chart {
            width: 600px; /* will be overriden by adjustSizes */
            height: 230px;
        }

        .columnLayout {
            flex-direction: column;
        }

        .no-data {
            font-size: 20px;
            display: flex;
            height: 100%;
            width: 100%;
            text-align: center;
            align-items: center;
            justify-content: center;
        }
    `

    render() {
        return html`
            <div
                class="wrapper"
                style="background-color: ${this.themeBgColor}; color: ${this.themeTitleColor}"
            >
                <header class="paging" ?active=${this.inputData?.title || this.inputData?.subTitle}>
                    <h3 class="paging" ?active=${this.inputData?.title}>${this.inputData?.title}</h3>
                    <p
                        class="paging"
                        ?active=${this.inputData?.subTitle}
                        style="color: ${this.themeSubtitleColor}"
                    >
                        ${this.inputData?.subTitle}
                    </p>
                </header>
                <div class="paging no-data" ?active=${this.canvasList.size === 0}>No Data</div>
                <div
                    class="chart-container ${this?.inputData?.axis?.columnLayout ? 'columnLayout' : ''}"
                ></div>
            </div>
        `
    }
}
