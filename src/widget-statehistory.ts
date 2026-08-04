import { html, css, LitElement, PropertyValueMap } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import tinycolor, { ColorInput } from 'tinycolor2'
import { Duration } from 'luxon'

import * as echarts from 'echarts/core'
import {
    TitleComponent,
    TooltipComponent,
    GridComponent,
    DataZoomComponent,
    LegendComponent,
    ToolboxComponent
} from 'echarts/components'
import { CustomChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
    TitleComponent,
    TooltipComponent,
    GridComponent,
    DataZoomComponent,
    CustomChart,
    CanvasRenderer,
    LegendComponent,
    // The option template declares a toolbox with the zoom `restore` button and
    // applyData() shows it whenever axis.xAxisZoom is on. Without registering
    // the component here ECharts logs "Component toolbox is used but not
    // imported" and drops it, so the reset button never appears.
    ToolboxComponent
])

import { Color, StateHistoryConfiguration } from './definition-schema'
import { CustomSeriesOption, CustomSeriesRenderItemReturn, EChartsOption, SeriesOption } from 'echarts'

type Theme = {
    theme_name: string
    theme_object: any
}
@customElement('widget-statehistory-versionplaceholder')
export class WidgetStateHistory extends LitElement {
    @property({ type: Object })
    inputData?: StateHistoryConfiguration

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
        this.renderItem = this.renderItem.bind(this)

        this.template = {
            tooltip: {},
            title: {
                text: 'Profile',
                left: 'left'
            },
            legend: {
                data: [
                    {
                        name: 'RUNNING',
                        itemStyle: {
                            color: '#27ae60' // green
                        }
                    },
                    {
                        name: 'STOPPED',
                        itemStyle: {
                            color: '#c0392b' // red
                        }
                    }
                ],
                textStyle: {
                    fontSize: 12
                },
                top: 'top',
                right: 0,
                selectedMode: false
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
                    type: 'slider',
                    filterMode: 'weakFilter',
                    showDataShadow: false,
                    // Anchored to the bottom edge. This used to be a hardcoded
                    // `top: 400`, which placed the slider 400px down from the top
                    // of the widget regardless of its actual height — landing in
                    // the middle of the chart at any size other than that one.
                    bottom: 0,
                    labelFormatter: ''
                },
                {
                    type: 'inside',
                    filterMode: 'weakFilter'
                }
            ],
            grid: {
                top: 50,
                bottom: 10,
                left: 10,
                right: 10,
                containLabel: true
            },
            xAxis: {
                type: 'time',
                scale: true,
                // Without these the axis name defaults to nameLocation 'end',
                // which puts it past the right edge of the axis where the grid
                // clips it — so the configured X-Axis Label was never visible.
                nameLocation: 'middle',
                nameGap: 27
            },
            yAxis: {
                type: 'category',
                axisLine: {
                    show: false
                }
            },
            series: [
                {
                    type: 'custom',
                    name: 'RUNNING',
                    renderItem: undefined,
                    itemStyle: {
                        opacity: 0.8
                    },
                    encode: {
                        x: [1, 2],
                        y: 0
                    },
                    data: []
                }
            ]
        } as EChartsOption
    }

    renderItem(params: any, api: any): CustomSeriesRenderItemReturn {
        const asset = api.value(0)
        const start = api.coord([api.value(1), asset])
        const end = api.coord([api.value(2), asset])
        const height = api.size([0, 1])?.[1] * 0.6
        const rectShape = echarts.graphic.clipRectByRect(
            {
                x: start[0],
                y: start[1] - height / 2,
                width: end[0] - start[0],
                height: height
            },
            {
                x: params.coordSys.x,
                y: params.coordSys.y,
                width: params.coordSys.width,
                height: params.coordSys.height
            }
        )
        // console.log('renderItem', params, api, rectShape)
        return (
            rectShape && {
                type: 'rect',
                transition: ['shape'],
                shape: rectShape,
                style: api.style()
            }
        )
    }

    stateToColor(state: string): string {
        if (!this.inputData?.stateMap) return '#ccc'
        const colors = this.inputData.stateMap
        return (colors.find((s) => s.name == state)?.color || '#ccc') as string
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
        const cssBgColor = getComputedStyle(this).getPropertyValue('--re-tile-background-color').trim()
        this.themeBgColor = cssBgColor || this.theme?.theme_object?.backgroundColor
        this.themeTitleColor = cssTextColor || this.theme?.theme_object?.title?.textStyle?.color
        this.themeSubtitleColor =
            cssTextColor || this.theme?.theme_object?.title?.subtextStyle?.color || this.themeTitleColor

        if (!theme || !theme.theme_object || !theme.theme_name) return

        // Strip component keys for components we don't register, so ECharts
        // doesn't merge them into the chart option as defaults.
        const excludeKeys = [
            'parallel',
            'parallelAxis',
            'geo',
            'timeline',
            'markPoint',
            'markLine',
            'markArea',
            'brush',
            'calendar',
            'singleAxis',
            'polar',
            'radar',
            'axisPointer',
            'visualMap'
        ]
        const filteredTheme = Object.fromEntries(
            Object.entries(theme.theme_object).filter(([key]) => !excludeKeys.includes(key))
        )
        echarts.registerTheme(theme.theme_name, filteredTheme)
    }

    transformData() {
        if (!this?.inputData?.dataseries?.length) return

        // reset all existing chart dataseries
        this.canvasList.forEach((chartM) => {
            chartM.series = []
            chartM.doomed = true
        })
        this.inputData.dataseries.forEach((ds, l) => {
            ds.chartName ??= ''

            ds.data ??= []

            // pivot data
            const distincts = [...new Set(ds.data.map((d) => d.pivot ?? ''))].sort()

            distincts.forEach((piv, i) => {
                const prefix = piv ?? ''
                const label = ds.label ?? ''
                const name = prefix + (!!prefix && !!label ? ' - ' : '') + label
                const data =
                    (distincts.length === 1 ? ds.data : ds.data?.filter((d) => d.pivot === piv)) ?? []

                const data1 = data
                    .map((d) => ({ ...d, tsp: new Date(d.tsp ?? '') }))
                    .sort((a, b) => a.tsp.getTime() - b.tsp.getTime())

                const maxDateInData =
                    data1.length > 0 ? Math.max(...data1.map((d) => d.tsp.getTime())) : new Date().getTime()

                const maxDate = Math.min(new Date().getTime(), maxDateInData + 60 * 60 * 1000)
                const data2 = data1.map((d, j) => ({
                    name: d.state,
                    value: [
                        name,
                        d.tsp,
                        data1[j + 1]?.tsp ?? maxDate,
                        Duration.fromMillis(
                            (data1[j + 1]?.tsp.getTime() ?? new Date().getTime()) - d.tsp.getTime()
                        ).toFormat('h:mm:ss')
                    ],
                    itemStyle: {
                        normal: {
                            color: this.stateToColor(d.state ?? '')
                        }
                    }
                }))

                // preparing the echarts series option for later application
                const pds: any = {
                    type: 'custom',
                    name: name,
                    renderItem: this.renderItem,
                    itemStyle: {
                        opacity: 0.8
                    },
                    encode: {
                        x: [1, 2],
                        y: 0
                    },
                    data: data2 ?? []
                }
                let chartName = ds.chartName ?? ''
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

    /**
     * Assign properties onto a single-instance ECharts component.
     *
     * The option template holds `title`, `tooltip`, `xAxis`, `legend` and
     * `toolbox` as plain objects, but on every update after the first the option
     * comes from `getOption()`, which normalises each of them to a one-element
     * array. Writing `option.xAxis.name = …` then sets a property on the Array
     * itself and ECharts silently ignores it, so config changes (axis label,
     * legend toggle, zoom tool) appeared to do nothing until the chart was
     * recreated. Going through here keeps both shapes working.
     */
    private setComponent(option: any, key: string, props: Record<string, any>) {
        const list = Array.isArray(option[key]) ? option[key] : [option[key] ?? {}]
        if (!list.length) list.push({})
        Object.assign(list[0], props)
        option[key] = list
    }

    applyData() {
        const modifier = 1

        this.canvasList.forEach((chart, label) => {
            chart.series.sort((a, b) => ((a.name as string) > (b.name as string) ? 1 : -1))
            this.requestUpdate()

            const option: any = chart.echart?.getOption() ?? window.structuredClone(this.template)

            // Strip component keys we don't register. ECharts' getOption() can return
            // theme-merged defaults for these, and feeding them back into setOption
            // triggers "Component X is used but not imported" warnings.
            for (const key of [
                'parallel',
                'parallelAxis',
                'geo',
                'timeline',
                'markPoint',
                'markLine',
                'markArea',
                'brush',
                'calendar',
                'singleAxis',
                'polar',
                'radar',
                'axisPointer',
                'visualMap'
            ]) {
                delete option[key]
            }

            option.renderItem = this.renderItem

            const showLegend = this.inputData?.axis?.showLegend ?? true
            const showZoom = this.inputData?.axis?.xAxisZoom ?? false

            // Title
            this.setComponent(option, 'title', { text: label })

            this.setComponent(option, 'tooltip', {
                formatter: (params: any) => params.marker + params.name + ': ' + params.value[3]
            })

            // Axis. nameLocation/nameGap are re-applied here because on the merge
            // path the option comes from getOption(), which may carry ECharts'
            // own defaults rather than the template's.
            const xAxisLabel = this.inputData?.axis?.xAxisLabel ?? ''
            this.setComponent(option, 'xAxis', {
                name: xAxisLabel,
                nameLocation: 'middle',
                nameGap: 27
            })
            this.setComponent(option, 'dataZoom', { show: showZoom, bottom: 0, top: undefined })
            this.setComponent(option, 'toolbox', { show: showZoom })

            // Neither the axis name nor the zoom slider is accounted for by the
            // grid's `containLabel`, so both need their room reserved explicitly
            // or they are drawn over the state bars.
            const ZOOM_THICKNESS = 40
            this.setComponent(option, 'grid', {
                bottom: (xAxisLabel ? 30 : 10) + (showZoom ? ZOOM_THICKNESS : 0)
            })

            option.series = chart.series

            // The legend and the zoom toolbox both sit in the top-right corner,
            // so the legend has to step aside for the restore button when the
            // zoom tool is on, or the icon is drawn over the last legend item.
            this.setComponent(option, 'legend', { show: showLegend, right: showZoom ? 45 : 0 })
            if (showLegend) {
                const legend = this.makeLegend()
                this.setComponent(option, 'legend', { data: legend.data })
                option.series.push(...legend.series)
            }

            chart.echart?.setOption(option)
            // chart.echart?.resize()
        })
    }

    makeLegend() {
        const data =
            this.inputData?.stateMap?.map((s) => ({
                name: s.name ?? '',
                itemStyle: {
                    color: s.color,
                    borderColor: this.theme?.theme_object?.timeAxis?.splitLine?.lineStyle ?? '#ccc',
                    borderWidth: 1
                }
            })) ?? []

        // otherwise the legend will not be rendered
        const series =
            this.inputData?.stateMap?.map((s) => ({
                type: 'custom',
                name: s.name ?? '',
                renderItem: () => null, // no visual rendering
                data: []
            })) ?? []
        return { data, series }
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
                <div class="paging no-data" ?adctive=${this.canvasList.size === 0}>No Data</div>
                <div
                    class="chart-container ${this?.inputData?.axis?.columnLayout ? 'columnLayout' : ''}"
                ></div>
            </div>
        `
    }
}
