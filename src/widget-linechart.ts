import { html, css, LitElement } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { property, state } from 'lit/decorators.js'
import Chart, { ChartDataset } from 'chart.js/auto'
import tinycolor, { ColorInput } from 'tinycolor2'
// This does not work. See comments at the end of the file.
// import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
// import 'chartjs-adapter-moment';
// import 'chartjs-adapter-date-fns';
import { InputData } from './definition-schema.js'

type Dataseries = Exclude<InputData['dataseries'], undefined>[number]
type Data = Exclude<Dataseries['data'], undefined>[number]

export class WidgetLinechart extends LitElement {
    @property({ type: Object })
    inputData?: InputData

    @state()
    private canvasList: Map<string, { chart?: any; dataSets: Dataseries[] }> = new Map()

    version: string = 'versionplaceholder'
    chartContainer?: HTMLElement | DocumentFragment

    update(changedProperties: Map<string, any>) {
        if (changedProperties.has('inputData') && this.chartContainer) {
            this.transformInputData()
            this.applyInputData()
        }
        super.update(changedProperties)
    }

    protected firstUpdated(): void {
        this.chartContainer = this.shadowRoot?.querySelector('.chart-container') as HTMLElement
        this.transformInputData()
        this.applyInputData()
    }

    transformInputData() {
        if (!this?.inputData?.dataseries?.length) return

        // reset all existing chart dataseries
        this.canvasList.forEach((chartM) => (chartM.dataSets = []))
        this.inputData.dataseries.sort((a, b) => (a.advanced?.drawOrder ?? 0) - (b.advanced?.drawOrder ?? 0))
        this.inputData.dataseries.forEach((ds) => {
            ds.advanced ??= {}
            ds.advanced.chartName ??= ''
            if (ds.borderDash && typeof ds.borderDash === 'string') {
                ds.borderDash = JSON.parse(ds.borderDash)
            } else {
                ds.borderDash = undefined
            }
            ds.data ??= []

            // pivot data
            const distincts = [...new Set(ds.data.map((d: Data) => d.pivot))].sort()
            const derivedBgColors = tinycolor(ds.backgroundColor as ColorInput | undefined)
                .monochromatic(distincts.length)
                .map((c: any) => c.toHexString())
            const derivedBdColors = tinycolor(ds.borderColor as ColorInput | undefined)
                .monochromatic(distincts.length)
                .map((c: any) => c.toHexString())
            //sd
            distincts.forEach((piv, i) => {
                const prefix = piv ? `${piv} - ` : ''
                const pds: any = {
                    label: prefix + ds.label,
                    type: ds.type,
                    showLine: true,
                    borderColor: ds.advanced?.chartName?.includes('#split#')
                        ? ds.borderColor
                        : derivedBdColors[i],
                    backgroundColor: ds.advanced?.chartName?.includes('#split#')
                        ? ds.backgroundColor
                        : derivedBgColors[i],
                    styling: ds.styling,
                    pointStyle: ds.styling?.pointStyle,
                    radius: ds.styling?.radius,
                    fill: ds.styling?.fill,
                    borderWidth: ds.styling?.borderWidth,
                    borderDash: ds.borderDash,
                    advanced: ds.advanced,
                    data: distincts.length === 1 ? ds.data : ds.data?.filter((d) => d.pivot === piv)
                }
                let chartName = ds.advanced?.chartName ?? ''
                if (chartName.includes('#split#')) {
                    chartName = prefix + chartName
                }
                // If the chartName ends with :pivot: then create a seperate chart for each pivoted dataseries

                if (!this.canvasList.has(chartName)) {
                    // initialize new charts
                    this.canvasList.set(chartName, { chart: undefined, dataSets: [] as Dataseries[] })
                }
                this.canvasList.get(chartName)?.dataSets.push(pds)
            })
        })
        // prevent duplicate transformation
        // this.inputData.dataseries = []
        // console.log('new linechart datasets', this.canvasList)
    }

    applyInputData() {
        this.setupCharts()

        this.requestUpdate()
        this.canvasList.forEach(({ chart, dataSets }) => {
            if (chart) {
                chart.data.datasets = dataSets
                chart.options.scales.x.type = this.xAxisType()
                chart.options.scales.x.title.display = !!this.inputData?.axis?.xAxisLabel
                chart.options.scales.x.title.text = this.inputData?.axis?.xAxisLabel
                chart.options.scales.y.title.display = !!this.inputData?.axis?.yAxisLabel
                chart.options.scales.y.title.text = this.inputData?.axis?.yAxisLabel
                chart?.update('resize')
            }
        })
    }

    xAxisType(): 'linear' | 'logarithmic' | 'category' | 'time' | 'timeseries' | undefined {
        if (this.inputData?.axis?.timeseries) return 'time'
        const onePoint = this.inputData?.dataseries?.[0]?.data?.[0]
        if (!isNaN(Number(onePoint?.x))) return 'linear'
        return 'category'
    }

    setupCharts() {
        this.canvasList.forEach((chartM, chartName) => {
            if (!chartM.dataSets.length) {
                this.shadowRoot?.querySelector(`div[name="${chartName}"]`)?.remove()
                this.canvasList.delete(chartName)
                return
            }
            if (chartM.chart) return

            if (!this.chartContainer) throw new Error('chartContainer not found')

            const newContainer = document.createElement('div')
            newContainer.setAttribute('name', chartName)
            newContainer.setAttribute('class', 'sizer')
            const canvas = document.createElement('canvas')
            canvas.setAttribute('name', chartName)
            newContainer.appendChild(canvas)
            this.chartContainer.appendChild(newContainer)

            if (!canvas) throw new Error('canvas not found')
            // console.log('chartM', canvas, chartM.chart)
            chartM.chart = new Chart(canvas, {
                type: 'line',
                data: {
                    // @ts-ignore
                    datasets: chartM.dataSets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animations: {
                        colors: false,
                        x: false
                    },
                    transitions: {
                        active: {
                            animation: {
                                duration: 100
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: this.xAxisType(),
                            title: {
                                display: !!this.inputData?.axis?.xAxisLabel,
                                text: this.inputData?.axis?.xAxisLabel
                            }
                        },
                        y: {
                            title: {
                                display: !!this.inputData?.axis?.yAxisLabel,
                                text: this.inputData?.axis?.yAxisLabel
                            }
                        }
                    }
                }
            })
        })
    }

    static styles = css`
        :host {
            display: block;
            color: var(--re-text-color, #000);

            font-family: sans-serif;
            padding: 16px;
            box-sizing: border-box;
            margin: auto;
        }

        .paging:not([active]) {
            display: none !important;
        }

        .columnLayout {
            flex-direction: column;
        }

        .wrapper {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
        }

        .chart-container {
            display: flex;
            flex: 1;
            overflow: hidden;
            position: relative;
        }

        .sizer {
            flex: 1;
            overflow: hidden;
            position: relative;
        }

        header {
            display: flex;
            flex-direction: column;
            margin: 0 0 16px 0;
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
        }
    `

    render() {
        return html`
            <div class="wrapper">
                <header>
                    <h3 class="paging" ?active=${this.inputData?.title}>${this.inputData?.title}</h3>
                    <p class="paging" ?active=${this.inputData?.subTitle}>${this.inputData?.subTitle}</p>
                </header>

                <div
                    class="chart-container ${this?.inputData?.axis?.columnLayout ? 'columnLayout' : ''}"
                ></div>
            </div>
        `
    }
}
window.customElements.define('widget-linechart-versionplaceholder', WidgetLinechart)

// ############################################### WORKAROUND #######################################################################
//
// For some reason the import of that adapter is messed up. I suspect that rollup does things in the wrong order.
// Because this is an import that has side effects. i.e. it overrides the adapters of the previously imported Chart.js
// So the current solution is to execute the source code here in-line. (moving this to a local file and importing that does not work!)
// This is the source code of https://github.com/chartjs/chartjs-adapter-date-fns/blob/master/src/index.js

import { _adapters } from 'chart.js'

import {
    parse,
    parseISO,
    toDate,
    isValid,
    format,
    startOfSecond,
    startOfMinute,
    startOfHour,
    startOfDay,
    startOfWeek,
    startOfMonth,
    startOfQuarter,
    startOfYear,
    addMilliseconds,
    addSeconds,
    addMinutes,
    addHours,
    addDays,
    addWeeks,
    addMonths,
    addQuarters,
    addYears,
    differenceInMilliseconds,
    differenceInSeconds,
    differenceInMinutes,
    differenceInHours,
    differenceInDays,
    differenceInWeeks,
    differenceInMonths,
    differenceInQuarters,
    differenceInYears,
    endOfSecond,
    endOfMinute,
    endOfHour,
    endOfDay,
    endOfWeek,
    endOfMonth,
    endOfQuarter,
    endOfYear
} from 'date-fns'

const FORMATS = {
    datetime: 'MMM d, yyyy, h:mm:ss aaaa',
    millisecond: 'h:mm:ss.SSS aaaa',
    second: 'h:mm:ss aaaa',
    minute: 'h:mm aaaa',
    hour: 'ha',
    day: 'MMM d',
    week: 'PP',
    month: 'MMM yyyy',
    quarter: 'qqq - yyyy',
    year: 'yyyy'
}

_adapters._date.override({
    _id: 'date-fns', // DEBUG
    formats: function () {
        return FORMATS
    },

    parse: function (value, fmt) {
        if (value === null || typeof value === 'undefined') {
            return null
        }
        const type = typeof value
        if (type === 'number' || value instanceof Date) {
            // @ts-ignore
            value = toDate(value)
        } else if (type === 'string') {
            if (typeof fmt === 'string') {
                // @ts-ignore
                value = parse(value, fmt, new Date(), this.options)
            } else {
                // @ts-ignore
                value = parseISO(value, this.options)
            }
        }
        // @ts-ignore
        return isValid(value) ? value.getTime() : null
    },

    format: function (time, fmt) {
        return format(time, fmt, this.options)
    },

    // @ts-ignore
    add: function (time, amount, unit) {
        switch (unit) {
            case 'millisecond':
                return addMilliseconds(time, amount)
            case 'second':
                return addSeconds(time, amount)
            case 'minute':
                return addMinutes(time, amount)
            case 'hour':
                return addHours(time, amount)
            case 'day':
                return addDays(time, amount)
            case 'week':
                return addWeeks(time, amount)
            case 'month':
                return addMonths(time, amount)
            case 'quarter':
                return addQuarters(time, amount)
            case 'year':
                return addYears(time, amount)
            default:
                return time
        }
    },

    diff: function (max, min, unit) {
        switch (unit) {
            case 'millisecond':
                return differenceInMilliseconds(max, min)
            case 'second':
                return differenceInSeconds(max, min)
            case 'minute':
                return differenceInMinutes(max, min)
            case 'hour':
                return differenceInHours(max, min)
            case 'day':
                return differenceInDays(max, min)
            case 'week':
                return differenceInWeeks(max, min)
            case 'month':
                return differenceInMonths(max, min)
            case 'quarter':
                return differenceInQuarters(max, min)
            case 'year':
                return differenceInYears(max, min)
            default:
                return 0
        }
    },

    // @ts-ignore
    startOf: function (time, unit, weekday) {
        switch (unit) {
            case 'second':
                return startOfSecond(time)
            case 'minute':
                return startOfMinute(time)
            case 'hour':
                return startOfHour(time)
            case 'day':
                return startOfDay(time)
            case 'week':
                return startOfWeek(time)
            case 'isoWeek':
                // @ts-ignore
                return startOfWeek(time, { weekStartsOn: +weekday })
            case 'month':
                return startOfMonth(time)
            case 'quarter':
                return startOfQuarter(time)
            case 'year':
                return startOfYear(time)
            default:
                return time
        }
    },

    // @ts-ignore
    endOf: function (time, unit) {
        switch (unit) {
            case 'second':
                return endOfSecond(time)
            case 'minute':
                return endOfMinute(time)
            case 'hour':
                return endOfHour(time)
            case 'day':
                return endOfDay(time)
            case 'week':
                return endOfWeek(time)
            case 'month':
                return endOfMonth(time)
            case 'quarter':
                return endOfQuarter(time)
            case 'year':
                return endOfYear(time)
            default:
                return time
        }
    }
})
