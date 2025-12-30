import { JSDOM } from 'jsdom';
import * as d3 from 'd3';
import { Theme } from '../const/theme';

export class Card {
  title: string;
  width: number;
  height: number;
  xPadding: number;
  yPadding: number;
  theme: Theme;
  private body: d3.Selection<HTMLElement, unknown, null, undefined>;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private mainGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

  constructor(
    title: string,
    width: number,
    height: number,
    theme: Theme,
    xPadding: number = 20,
    yPadding: number = 30
  ) {
    this.title = title;
    this.width = width;
    this.height = height;
    this.theme = theme;
    this.xPadding = xPadding;
    this.yPadding = yPadding;

    // Create fake DOM for SVG generation
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    this.body = d3.select(dom.window.document.body) as d3.Selection<HTMLElement, unknown, null, undefined>;

    const container = this.body.append('div').attr('class', 'container');

    this.svg = container
      .append('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Add styles
    this.svg.append('style').text(`
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
      * {
        font-family: 'JetBrains Mono', 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
      }
      .title {
        font-weight: 600;
        letter-spacing: -0.5px;
      }
      .subtitle {
        font-weight: 400;
        opacity: 0.8;
      }
      .stat-value {
        font-weight: 600;
      }
      .stat-label {
        font-weight: 400;
        opacity: 0.7;
      }
      .day-label, .month-label {
        font-size: 9px;
        fill: ${theme.text};
        opacity: 0.6;
      }
    `);

    // Background with rounded corners
    this.svg
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', theme.background)
      .attr('stroke', theme.stroke)
      .attr('stroke-width', 1)
      .attr('stroke-opacity', theme.strokeOpacity);

    // Add title
    this.svg
      .append('text')
      .attr('class', 'title')
      .attr('x', xPadding)
      .attr('y', yPadding)
      .attr('fill', theme.title)
      .attr('font-size', '16px')
      .text(title);

    // Create main group for content
    this.mainGroup = this.svg.append('g').attr('transform', `translate(0, 40)`);
  }

  getSVG(): d3.Selection<SVGGElement, unknown, null, undefined> {
    return this.mainGroup;
  }

  getRootSVG(): d3.Selection<SVGSVGElement, unknown, null, undefined> {
    return this.svg;
  }

  toString(): string {
    return this.body.select('.container').html();
  }
}

