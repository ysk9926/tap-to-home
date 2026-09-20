"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import type { DashboardData } from "@/features/admin/types";
import styles from "./admin.module.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Legend, Title, Tooltip);

type CanvasContext = { chart: { canvas: HTMLCanvasElement } };

function tokenColor(token: `--${string}`) {
  return (context: CanvasContext) => {
    if (typeof window === "undefined") return "transparent";
    return window.getComputedStyle(context.chart.canvas).getPropertyValue(token).trim() || "transparent";
  };
}

function indexedTokenColor(first: `--${string}`, second: `--${string}`) {
  return (context: CanvasContext & { dataIndex: number }) => tokenColor(context.dataIndex === 0 ? first : second)(context);
}

const ink = tokenColor("--ink");
const pencil = tokenColor("--pencil");
const soft = tokenColor("--pencil-soft");
const paper = tokenColor("--paper");
const line = tokenColor("--line");

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 },
  color: pencil,
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: { usePointStyle: true, boxWidth: 8, font: { family: "Apple SD Gothic Neo, Malgun Gothic, sans-serif", size: 11 } },
    },
    tooltip: { backgroundColor: ink, titleColor: paper, bodyColor: paper, displayColors: false },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: soft, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
    y: { beginAtZero: true, grid: { color: line }, ticks: { color: soft, precision: 0 } },
  },
} satisfies ChartOptions<"line">;

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${month}.${day}`;
}

export function TrendChart({ points }: { points: DashboardData["trend"] }) {
  const data = {
    labels: points.map((point) => shortDate(point.date)),
    datasets: [
      { label: "방문", data: points.map((point) => point.visitors), borderColor: ink, backgroundColor: ink, borderWidth: 2, pointStyle: "circle" as const, pointRadius: 3, spanGaps: false, tension: 0 },
      { label: "플레이", data: points.map((point) => point.players), borderColor: soft, backgroundColor: soft, borderWidth: 2, borderDash: [6, 5], pointStyle: "rectRot" as const, pointRadius: 3, tension: 0 },
    ],
  };
  return (
    <>
      <div className={styles.chartBox}><Line aria-label="날짜별 방문자와 플레이어 추이" role="img" data={data} options={baseOptions} /></div>
      <details className={styles.details}>
        <summary>같은 데이터를 표로 보기</summary>
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.data}`}><thead><tr><th>날짜</th><th>방문</th><th>플레이</th></tr></thead><tbody>
            {points.map((point) => <tr key={point.date}><td>{point.date}</td><td>{point.visitors ?? "수집 중"}</td><td>{point.players.toLocaleString("ko-KR")}</td></tr>)}
          </tbody></table>
        </div>
      </details>
    </>
  );
}

export function ActivationChart({ points }: { points: DashboardData["trend"] }) {
  const options = { ...baseOptions, plugins: { ...baseOptions.plugins, legend: baseOptions.plugins.legend } } satisfies ChartOptions<"bar">;
  const data = {
    labels: points.map((point) => shortDate(point.date)),
    datasets: [
      { label: "신규 가입", data: points.map((point) => point.signups), backgroundColor: ink, borderColor: ink, borderWidth: 1 },
      { label: "24시간 내 첫 탭", data: points.map((point) => point.activated), backgroundColor: paper, borderColor: pencil, borderWidth: 2 },
    ],
  };
  return (
    <>
      <div className={styles.chartBox}><Bar aria-label="날짜별 신규 가입과 첫 탭 활성화" role="img" data={data} options={options} /></div>
      <details className={styles.details}><summary>같은 데이터를 표로 보기</summary><div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.data}`}><thead><tr><th>날짜</th><th>가입</th><th>24시간 내 첫 탭</th></tr></thead><tbody>
          {points.map((point) => <tr key={point.date}><td>{point.date}</td><td>{point.signups}</td><td>{point.activated ?? "관찰 중"}</td></tr>)}
        </tbody></table>
      </div></details>
    </>
  );
}

export function StageChart({ points }: { points: DashboardData["stages"] }) {
  const options = {
    ...baseOptions,
    indexAxis: "y" as const,
    plugins: { ...baseOptions.plugins, legend: { display: false } },
    scales: {
      x: { beginAtZero: true, max: 100, grid: { color: line }, ticks: { color: soft, callback: (value: string | number) => `${value}%` } },
      y: { grid: { display: false }, ticks: { color: pencil } },
    },
  } satisfies ChartOptions<"bar">;
  return (
    <>
      <div className={styles.chartBox}><Bar aria-label="레이스 구간별 누적 도달률" role="img" data={{ labels: points.map((point) => point.label), datasets: [{ label: "도달률", data: points.map((point) => point.rate), backgroundColor: ink, borderColor: ink, borderWidth: 1 }] }} options={options} /></div>
      <details className={styles.details}><summary>같은 데이터를 표로 보기</summary><div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.data}`}><thead><tr><th>구간</th><th>기준 탭</th><th>도달</th><th>도달률</th></tr></thead><tbody>
          {points.map((point) => <tr key={point.label}><td>{point.label}</td><td>{point.threshold.toLocaleString("ko-KR")}</td><td>{point.count} / {point.total}</td><td>{point.rate === null ? "대상 없음" : `${point.rate.toFixed(1)}%`}</td></tr>)}
        </tbody></table>
      </div></details>
    </>
  );
}

export function HourlyChart({ points }: { points: DashboardData["hourly"] }) {
  const options = { ...baseOptions, plugins: { ...baseOptions.plugins, legend: { display: false } } } satisfies ChartOptions<"bar">;
  return (
    <>
      <div className={`${styles.chartBox} ${styles.chartBoxTall}`}><Bar aria-label="KST 시간대별 서버 수신 탭 수" role="img" data={{ labels: points.map((point) => `${point.hour}시`), datasets: [{ label: "탭", data: points.map((point) => point.taps), backgroundColor: ink, borderColor: ink, borderWidth: 1 }] }} options={options} /></div>
      <details className={styles.details}><summary>같은 데이터를 표로 보기</summary><div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.data}`}><thead><tr><th>시간</th><th>서버 수신 탭</th><th>플레이 인원</th></tr></thead><tbody>
          {points.map((point) => <tr key={point.hour}><td>{point.hour}:00–{point.hour}:59</td><td>{point.taps.toLocaleString("ko-KR")}</td><td>{point.players.toLocaleString("ko-KR")}</td></tr>)}
        </tbody></table>
      </div></details>
    </>
  );
}

export function SocialChart({ points }: { points: DashboardData["social"] }) {
  const options = { ...baseOptions, plugins: { ...baseOptions.plugins, legend: { display: false } }, scales: { ...baseOptions.scales, y: { ...baseOptions.scales.y, max: 100 } } } satisfies ChartOptions<"bar">;
  return (
    <>
      <div className={styles.chartBox}><Bar aria-label="가입 24시간 내 친구 연결 여부별 D7 재방문율" role="img" data={{ labels: points.map((point) => point.label), datasets: [{ label: "D7 재방문율", data: points.map((point) => point.rate), backgroundColor: indexedTokenColor("--ink", "--paper"), borderColor: pencil, borderWidth: 2 }] }} options={options} /></div>
      <details className={styles.details}><summary>같은 데이터를 표로 보기</summary><div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.data}`}><thead><tr><th>집단</th><th>대상</th><th>재방문</th><th>D7</th></tr></thead><tbody>
          {points.map((point) => <tr key={point.label}><td>{point.label}</td><td>{point.size}</td><td>{point.retained}</td><td>{point.rate === null ? "관찰 중" : `${point.rate.toFixed(1)}%`}</td></tr>)}
        </tbody></table>
      </div></details>
    </>
  );
}

export function TitlesChart({ points }: { points: DashboardData["titles"] }) {
  const options = { ...baseOptions, indexAxis: "y" as const, plugins: { ...baseOptions.plugins, legend: { display: false } } } satisfies ChartOptions<"bar">;
  return (
    <>
      <div className={`${styles.chartBox} ${styles.chartBoxTall}`}><Bar aria-label="칭호별 획득 사용자 날짜 수" role="img" data={{ labels: points.map((point) => point.name), datasets: [{ label: "획득", data: points.map((point) => point.count), backgroundColor: ink, borderColor: ink, borderWidth: 1 }] }} options={options} /></div>
      <details className={styles.details}><summary>같은 데이터를 표로 보기</summary><div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.data}`}><thead><tr><th>칭호</th><th>획득 사용자·날짜</th></tr></thead><tbody>
          {points.map((point) => <tr key={point.id}><td>{point.name}</td><td>{point.count.toLocaleString("ko-KR")}</td></tr>)}
        </tbody></table>
      </div></details>
    </>
  );
}
