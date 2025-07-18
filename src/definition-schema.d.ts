/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type Title = string;
export type Subtitle = string;
export type TimeAxisLabel = string;
/**
 * If checked, a zoom tool will be shown on the time-axis to zoom into the chart.
 */
export type TimeAxisZoomTool = boolean;
/**
 * If checked, a legend will be shown in the chart.
 */
export type ShowLegend = boolean;
/**
 * The name of the state as found in the data.
 */
export type StateName = string;
export type StateMap = {
    name?: StateName;
    color?: Color;
    [k: string]: unknown;
}[];
/**
 * The name for this data series
 */
export type Label = string;
/**
 * If two dataseries have the same 'Chart Name', they will be drawn in the same chart. Otherwise they will get their own chart. If the name contains #split# as substring then a separat chart will be drawn for each split dataseries.
 */
export type ChartName = string;
/**
 * For each asset the chart shows a line reflecting their state changes over time. This label is used to identify the asset in the chart.
 */
export type AssetLabel = string;
/**
 * The timestamp of the state change event.
 */
export type EventTimestamp = string;
/**
 * The state of the asset starting from the event timestamp.
 */
export type State = string;
/**
 * You can specify a column in the input data to autogenerate dataseries for each distinct entry in this column. E.g. if you have a table with columns [city, timestamp, temperature] and specify 'city' as split column, then you will get a line for each city.
 */
export type SplitDataBy = string;
/**
 * The data used to draw this data series.
 */
export type Data = {
    label?: AssetLabel;
    tsp?: EventTimestamp;
    state?: State;
    pivot?: SplitDataBy;
    [k: string]: unknown;
}[];
export type Dataseries = {
    label?: Label;
    chartName?: ChartName;
    data?: Data;
    [k: string]: unknown;
}[];

export interface InputData {
    title?: Title;
    subTitle?: Subtitle;
    axis?: AxisSettings;
    stateMap?: StateMap;
    dataseries?: Dataseries;
    [k: string]: unknown;
}
export interface AxisSettings {
    xAxisLabel?: TimeAxisLabel;
    xAxisZoom?: TimeAxisZoomTool;
    showLegend?: ShowLegend;
    [k: string]: unknown;
}
/**
 * The color of the state in the chart.
 */
export interface Color {
    [k: string]: unknown;
}
