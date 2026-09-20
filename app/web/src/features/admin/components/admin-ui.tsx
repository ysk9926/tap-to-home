"use client";

import type { ReactNode } from "react";
import type { Metric } from "@/features/admin/types";
import styles from "./admin.module.css";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageDescription}>{description}</p>
      </div>
      {actions}
    </header>
  );
}

function metricText(metric: Metric) {
  if (metric.status === "collecting") return "수집 중";
  if (metric.status === "empty") return "대상 없음";
  if (metric.value === null) return "—";
  if (metric.unit === "%") return metric.value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  return metric.value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function deltaText(metric: Metric) {
  if (metric.status !== "ready" || metric.value === null || metric.previous === undefined || metric.previous === null) return null;
  if (metric.previous === 0) return "이전 기간 비교 불가";
  const difference = metric.value - metric.previous;
  if (metric.unit === "%") return `이전보다 ${difference >= 0 ? "+" : ""}${difference.toFixed(1)}%p`;
  const rate = difference / metric.previous * 100;
  return `이전보다 ${difference >= 0 ? "+" : ""}${rate.toFixed(1)}%`;
}

export function MetricCards({ metrics, limit }: { metrics: Metric[]; limit?: number }) {
  const visible = limit ? metrics.slice(0, limit) : metrics;
  return (
    <section className={styles.metricGrid} aria-label="핵심 지표">
      {visible.map((metric) => {
        const delta = deltaText(metric);
        return (
          <article className={`${styles.panel} ${styles.metricCard} ${styles.data}`} key={metric.id} title={metric.hint}>
            <p className={styles.metricLabel}>{metric.label}</p>
            {metric.status === "ready" && metric.value !== null ? (
              <p className={styles.metricValue}>{metricText(metric)}<span className={styles.metricUnit}>{metric.unit}</span></p>
            ) : (
              <span className={styles.metricStatus}>{metricText(metric)}</span>
            )}
            <p className={styles.metricHint}>
              {metric.numerator !== undefined && metric.denominator !== undefined
                ? `${metric.numerator.toLocaleString("ko-KR")} / ${metric.denominator.toLocaleString("ko-KR")}${delta ? ` · ${delta}` : ""}`
                : delta ?? metric.hint}
            </p>
          </article>
        );
      })}
    </section>
  );
}

export function LoadingState({ cards = 6 }: { cards?: number }) {
  return (
    <div className={styles.metricGrid} aria-label="데이터를 불러오는 중" aria-busy="true">
      {Array.from({ length: cards }, (_, index) => <div key={index} className={`${styles.panel} ${styles.skeleton}`} />)}
    </div>
  );
}

export function ContentState({ kind, onRetry, onReset }: { kind: "error" | "empty"; onRetry?: () => void; onReset?: () => void }) {
  return (
    <section className={`${styles.panel} ${styles.state}`}>
      <div>
        <span className={styles.stateMark} aria-hidden="true">{kind === "error" ? "지직…" : "텅"}</span>
        <h2 className={styles.stateTitle}>{kind === "error" ? "불러오지 못했어요" : "조건에 맞는 기록이 없어요"}</h2>
        <p className={styles.stateText}>
          {kind === "error" ? "잠시 연결이 고르지 않거나 집계에 실패했어요." : "기간이나 필터를 바꾸면 다른 기록을 찾을 수 있어요."}
        </p>
        {onRetry && <button type="button" className={styles.button} onClick={onRetry}>다시 불러오기</button>}
        {onReset && <button type="button" className={styles.button} onClick={onReset}>필터 초기화</button>}
      </div>
    </section>
  );
}

export function StatusBadge({ status }: { status: "active" | "suspended" | "deleted" }) {
  const labels = { active: "정상", suspended: "이용 정지", deleted: "탈퇴" };
  return <span className={`${styles.badge} ${status === "suspended" ? styles.badgeMarked : status === "deleted" ? styles.badgeMuted : ""}`}>{labels[status]}</span>;
}

export function formatDate(value: string | null, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function formatMetric(metric: Metric) {
  return metric.status === "ready" && metric.value !== null ? `${metricText(metric)}${metric.unit}` : metricText(metric);
}
