"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import type { DashboardData } from "@/features/admin/types";
import { adminFetch } from "./admin-query-provider";
import { ActivationChart, HourlyChart, SocialChart, StageChart, TitlesChart, TrendChart } from "./admin-charts";
import { ContentState, LoadingState, MetricCards, PageHeader, formatDate, formatMetric } from "./admin-ui";
import { DateRangeFilter } from "./date-range-filter";
import styles from "./admin.module.css";

type DashboardMode = "overview" | "analytics" | "engagement";

function pickMetrics(data: DashboardData, ids: string[]) {
  const metrics = new Map(data.metrics.map((metric) => [metric.id, metric]));
  return ids.flatMap((id) => {
    const metric = metrics.get(id);
    return metric ? [metric] : [];
  });
}

const pageCopy = {
  overview: {
    eyebrow: "운영 기록 01",
    title: "전체 현황",
    description: "가입부터 퇴근 완료까지, 지금 먼저 살펴볼 흐름을 한 장에 모았어요.",
    endpoint: "overview",
  },
  analytics: {
    eyebrow: "운영 기록 02",
    title: "접속·재방문",
    description: "사람들이 처음 들어온 날과 다시 찾아온 날을 같은 기준으로 비교해요.",
    endpoint: "analytics",
  },
  engagement: {
    eyebrow: "운영 기록 03",
    title: "레이스·소셜",
    description: "어디에서 멈추고, 언제 달리며, 친구와 칭호가 어떤 차이를 만드는지 살펴봐요.",
    endpoint: "engagement",
  },
} as const;

function Panel({ title, note, children, className = "" }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <div className={styles.panelInner}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {note && <p className={`${styles.panelNote} ${styles.data}`}>{note}</p>}
        {children}
      </div>
    </section>
  );
}

function CohortTable({ data }: { data: DashboardData }) {
  if (data.cohorts.length === 0) return <ContentState kind="empty" />;
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.data}`}>
        <thead><tr><th>가입일</th><th>대상</th><th>D1</th><th>D7</th></tr></thead>
        <tbody>
          {data.cohorts.map((cohort) => (
            <tr key={cohort.date}>
              <td>{cohort.date}</td>
              <td>{cohort.size.toLocaleString("ko-KR")}</td>
              <td className={`${styles.cohortCell} ${cohort.d1.status === "ready" ? styles.cohortReady : ""}`}>{formatMetric(cohort.d1)}</td>
              <td className={`${styles.cohortCell} ${cohort.d7.status === "ready" ? styles.cohortReady : ""}`}>{formatMetric(cohort.d7)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollectionNotice({ startedAt }: { startedAt: string | null }) {
  return (
    <aside className={styles.notice}>
      {startedAt
        ? `방문·행동 계측은 ${formatDate(startedAt)}부터 모으고 있어요. 그보다 앞선 빈칸은 0명이 아닙니다.`
        : "방문·행동 계측을 아직 시작하지 않았어요. 플레이 기록으로 계산할 수 있는 항목만 표시합니다."}
    </aside>
  );
}

function Overview({ data }: { data: DashboardData }) {
  return (
    <>
      <MetricCards metrics={pickMetrics(data, ["active_members", "signups", "average_visitors", "stickiness", "d7_retention", "completion_rate"])} />
      <div className={styles.twoColumns}>
        <Panel title="일별 방문·플레이 추이" note="실선 방문 · 점선 플레이 · 단위 명"><TrendChart points={data.trend} /></Panel>
        <Panel title="레이스 구간 도달률" note="한 번이라도 탭한 플레이일 기준"><StageChart points={data.stages} /></Panel>
      </div>
      <div className={styles.equalColumns}>
        <Panel title="가입 코호트별 재방문" note="D1·D7 관찰일이 끝난 모집단만 계산"><CohortTable data={data} /></Panel>
        <Panel title="운영 확인" note="완료된 날짜의 정산 상태">
          <div className={styles.state}>
            <div>
              <span className={styles.stateMark} aria-hidden="true">체크!</span>
              <h3 className={`${styles.metricValue} ${styles.data}`}>{data.unsettledRuns.toLocaleString("ko-KR")}<span className={styles.metricUnit}>건</span></h3>
              <p className={styles.stateText}>플레이 기록은 있지만 결과가 없는 정산 누락</p>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Analytics({ data }: { data: DashboardData }) {
  return (
    <>
      <MetricCards metrics={pickMetrics(data, ["average_visitors", "play_dau", "wau", "mau", "stickiness", "play_participation", "activation_30s", "activation_24h", "d1_retention", "d7_retention"])} />
      <div className={styles.stack} style={{ marginTop: 16 }}>
        <Panel title="방문과 플레이의 일별 흐름" note="방문 계측 전 값은 0으로 채우지 않음"><TrendChart points={data.trend} /></Panel>
        <Panel title="가입과 첫 플레이" note="가입 후 24시간 관찰이 끝난 사용자만 활성화에 포함"><ActivationChart points={data.trend} /></Panel>
        <Panel title="가입 코호트별 재방문" note="날짜별 비율의 평균이 아닌 분자·분모 합산 기준"><CohortTable data={data} /></Panel>
        <Panel title="해석 메모">
          <p className={styles.pageDescription}>수집 중인 날짜와 완료된 날짜를 직접 비교하지 않습니다. 표본이 적은 코호트는 방향을 살피는 단서로만 사용하고, 변화의 원인은 제품 변경 시점과 함께 확인해 주세요.</p>
        </Panel>
      </div>
    </>
  );
}

function Engagement({ data }: { data: DashboardData }) {
  return (
    <>
      <MetricCards metrics={pickMetrics(data, ["completion_rate", "median_taps", "signal_read_24h", "result_viewed_24h"])} />
      <div className={styles.twoColumns}>
        <Panel title="레이스 구간 도달률" note="플레이한 사용자·날짜 쌍의 누적 도달률"><StageChart points={data.stages} /></Panel>
        <Panel title="탭이 모이는 시간" note="KST · 실제 손가락 시각이 아닌 서버 수신 시각"><HourlyChart points={data.hourly} /></Panel>
      </div>
      <div className={styles.equalColumns}>
        <Panel title="친구 연결과 D7" note="가입 24시간 내 친구 연결 유무별 관찰"><SocialChart points={data.social} /></Panel>
        <Panel title="칭호 획득 분포" note="선택 기간의 사용자·날짜별 획득 건"><TitlesChart points={data.titles} /></Panel>
      </div>
      <Panel title="해석 메모" className={styles.stack}>
        <p className={styles.pageDescription}>친구가 있는 사용자의 재방문율이 높아도 친구 기능이 재방문을 만들었다고 단정할 수는 없어요. 집단 크기와 기능 변경 전후를 함께 확인합니다.</p>
      </Panel>
    </>
  );
}

export function DashboardView({ adminId, mode }: { adminId: string; mode: DashboardMode }) {
  const searchParams = useSearchParams();
  const copy = pageCopy[mode];
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const queryString = query.toString();
  const result = useQuery({
    queryKey: ["admin", adminId, copy.endpoint, from, to],
    queryFn: ({ signal }) => adminFetch<DashboardData>(`/api/admin/${copy.endpoint}${queryString ? `?${queryString}` : ""}`, { signal }),
  });

  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={<button type="button" className={styles.quietButton} onClick={() => void result.refetch()} disabled={result.isFetching}>{result.isFetching ? "새로 쓰는 중…" : "새로고침"}</button>}
      />
      <DateRangeFilter />
      <div style={{ marginTop: 18 }}>
        {result.isPending ? <LoadingState /> : result.isError ? <ContentState kind="error" onRetry={() => void result.refetch()} /> : (
          <>
            <CollectionNotice startedAt={result.data.collectionStartedAt} />
            <p className={`${styles.panelNote} ${styles.data}`} style={{ marginBottom: 10 }}>
              {result.data.range.from}–{result.data.range.to} · KST · 마지막 집계 {formatDate(result.data.generatedAt, true)}
            </p>
            {mode === "overview" ? <Overview data={result.data} /> : mode === "analytics" ? <Analytics data={result.data} /> : <Engagement data={result.data} />}
          </>
        )}
      </div>
    </>
  );
}
