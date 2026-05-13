import { Injectable } from '@nestjs/common';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { PetEvent, PetEventType, WalkEventValue, FoodEventValue, WeightEventValue } from '../pet-events/entities/pet-event.entity';

const WIDTH = 600;
const HEIGHT = 350;

@Injectable()
export class ChartService {
    private readonly canvas = new ChartJSNodeCanvas({
        width: WIDTH,
        height: HEIGHT,
        backgroundColour: '#ffffff',
    });

    /** Group events by day label (DD.MM) */
    private groupByDay(events: PetEvent[]): Map<string, PetEvent[]> {
        const map = new Map<string, PetEvent[]>();
        for (const ev of events) {
            const d = new Date(ev.createdAt);
            const key = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
            const arr = map.get(key) ?? [];
            arr.push(ev);
            map.set(key, arr);
        }
        return map;
    }

    /** Build a sorted list of day labels between first and last event */
    private buildDayLabels(events: PetEvent[]): string[] {
        if (events.length === 0) return [];
        const sorted = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const start = new Date(sorted[0].createdAt);
        const end = new Date(sorted[sorted.length - 1].createdAt);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const labels: string[] = [];
        const cur = new Date(start);
        while (cur <= end) {
            labels.push(`${String(cur.getDate()).padStart(2, '0')}.${String(cur.getMonth() + 1).padStart(2, '0')}`);
            cur.setDate(cur.getDate() + 1);
        }
        return labels;
    }

    async renderStatsChart(events: PetEvent[]): Promise<Buffer | null> {
        if (events.length === 0) return null;

        const labels = this.buildDayLabels(events);
        if (labels.length === 0) return null;

        const byDay = this.groupByDay(events);

        // Walks per day
        const walksPerDay = labels.map(l => {
            const dayEvs = byDay.get(l) ?? [];
            return dayEvs.filter(e => e.type === PetEventType.WALK).length;
        });

        // Walk minutes per day
        const walkMinPerDay = labels.map(l => {
            const dayEvs = byDay.get(l) ?? [];
            return dayEvs
                .filter(e => e.type === PetEventType.WALK)
                .reduce((sum, e) => sum + ((e.value as WalkEventValue)?.durationMinutes ?? 0), 0);
        });

        // Feedings per day
        const feedingsPerDay = labels.map(l => {
            const dayEvs = byDay.get(l) ?? [];
            return dayEvs.filter(e => e.type === PetEventType.FOOD).length;
        });

        // Weight data points (may be sparse)
        const weightData = labels.map(l => {
            const dayEvs = byDay.get(l) ?? [];
            const wEvs = dayEvs.filter(e => e.type === PetEventType.WEIGHT);
            if (wEvs.length === 0) return null;
            return (wEvs[wEvs.length - 1].value as WeightEventValue).kg;
        });

        const hasWeight = weightData.some(v => v !== null);
        const hasWalks = walksPerDay.some(v => v > 0);
        const hasFood = feedingsPerDay.some(v => v > 0);

        if (!hasWeight && !hasWalks && !hasFood) return null;

        // Build datasets
        const datasets: any[] = [];

        if (hasWalks) {
            datasets.push({
                label: '🦮 Walks',
                data: walksPerDay,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                yAxisID: 'y',
                type: 'bar' as const,
                order: 2,
            });
            datasets.push({
                label: '⏱ Walk min',
                data: walkMinPerDay,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                yAxisID: 'y',
                type: 'bar' as const,
                order: 3,
            });
        }

        if (hasFood) {
            datasets.push({
                label: '🍽 Feedings',
                data: feedingsPerDay,
                backgroundColor: 'rgba(255, 159, 64, 0.6)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1,
                yAxisID: 'y',
                type: 'bar' as const,
                order: 4,
            });
        }

        if (hasWeight) {
            datasets.push({
                label: '⚖️ Weight (kg)',
                data: weightData,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderWidth: 2,
                pointRadius: 4,
                fill: false,
                spanGaps: true,
                yAxisID: 'y1',
                type: 'line' as const,
                order: 1,
            });
        }

        const config: any = {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 11 } } },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        position: 'left',
                        title: { display: true, text: 'Count / Min' },
                    },
                    ...(hasWeight ? {
                        y1: {
                            beginAtZero: false,
                            position: 'right',
                            title: { display: true, text: 'kg' },
                            grid: { drawOnChartArea: false },
                        },
                    } : {}),
                },
            },
        };

        return this.canvas.renderToBuffer(config);
    }
}
