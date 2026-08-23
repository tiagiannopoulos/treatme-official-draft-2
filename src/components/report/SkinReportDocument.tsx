import React from "react";
import {
  Circle,
  Document,
  Image,
  Line,
  Link,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { markerDrawing } from "@/lib/marker-shapes";
import {
  BAND_BAR,
  BAND_COLOR,
  BAND_ORDER,
  BAND_RANGE,
  NO_TREATMENT_LINE,
  type ReportData,
  type ReportIndicator,
} from "@/lib/report-data";

/**
 * the downloadable skin analysis report. 8 pages, letter portrait, all vector
 * text. colours are the app's brand tokens, everything lowercase.
 */

const INK = "#111111";
const MUTE = "#8A8A8A";
const HAIRLINE = "#E4E4E4";
const TRACK = "#EDEDED";
const PINK = "#F8A1C6";
const BUTTER = "#FFEDB4";

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
    color: INK,
  },
  row: { flexDirection: "row", alignItems: "flex-end" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  wordmark: { fontFamily: "Helvetica-Bold", fontSize: 22, letterSpacing: -0.6 },
  wordmarkDot: { fontFamily: "Helvetica-Bold", fontSize: 22, color: "#FF1F87" },
  headerRight: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  rule: { borderBottomWidth: 0.7, borderBottomColor: HAIRLINE },
  metaRow: { flexDirection: "row", paddingTop: 14, paddingBottom: 18 },
  metaCell: { width: "25%" },
  metaLabel: { fontSize: 6.5, color: MUTE, marginBottom: 4 },
  metaValue: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  scoreBand: {
    backgroundColor: BUTTER,
    paddingHorizontal: 20,
    paddingVertical: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 22,
  },
  scoreBig: { fontFamily: "Helvetica-Bold", fontSize: 44, letterSpacing: -1.5 },
  scoreOf: { fontSize: 12, color: "#6E6656", marginLeft: 3, marginBottom: 5 },
  overallLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", textAlign: "right", marginBottom: 3 },
  overallBand: { fontFamily: "Helvetica-Bold", fontSize: 17, textAlign: "right" },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 8 },
  body: { fontSize: 10.5, lineHeight: 1.55 },
  eyebrow: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  display: { fontFamily: "Helvetica-Bold", fontSize: 21, letterSpacing: -0.6, marginTop: 4, marginBottom: 16 },
  findingCards: { flexDirection: "row", marginTop: 4 },
  findingCard: { flex: 1, backgroundColor: PINK, padding: 14, height: 100, justifyContent: "space-between" },
  findingName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  findingScore: { fontFamily: "Helvetica-Bold", fontSize: 28, letterSpacing: -1 },
  findingBand: { fontSize: 6.5, color: "#6E4E5C", marginTop: 2 },
  groupHead: { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 6 },
  swatch: { width: 11, height: 11, marginRight: 7 },
  groupLabel: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  groupCount: { fontSize: 8, color: MUTE, marginLeft: 6 },
  barRow: { marginBottom: 9 },
  barTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  barLabel: { fontSize: 9 },
  barScore: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  track: { height: 3.5, backgroundColor: TRACK, flexDirection: "row" },
  legend: { flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 0.7, borderTopColor: HAIRLINE },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 16 },
  legendLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", marginRight: 4 },
  legendRange: { fontSize: 7, color: MUTE },
  pageTitle: { fontFamily: "Helvetica-Bold", fontSize: 21, letterSpacing: -0.6, marginBottom: 22 },
  detailRow: { flexDirection: "row", marginBottom: 20 },
  tile: { width: 72, height: 72, marginRight: 16, alignItems: "center", justifyContent: "center" },
  tileLetter: { fontSize: 30, fontFamily: "Helvetica-Bold", color: "#00000033" },
  detailBody: { flex: 1 },
  detailHead: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  detailName: { fontFamily: "Helvetica-Bold", fontSize: 13, letterSpacing: -0.3 },
  pill: { paddingHorizontal: 6, paddingVertical: 2.5, marginLeft: 8, marginRight: 8 },
  pillText: { fontSize: 6.5, fontFamily: "Helvetica-Bold" },
  detailScore: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  detailBlurb: { fontSize: 8.5, lineHeight: 1.5, color: "#2A2A2A" },
  txHead: { fontFamily: "Helvetica-Bold", fontSize: 8, marginTop: 8, marginBottom: 2 },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.7,
    borderTopColor: HAIRLINE,
    paddingVertical: 4.5,
  },
  txName: { fontSize: 8.5 },
  txMeta: { fontSize: 7.5, color: MUTE },
  planRow: { flexDirection: "row", marginBottom: 18 },
  numTile: { width: 34, height: 34, alignItems: "center", justifyContent: "center", marginRight: 14 },
  numText: { fontFamily: "Helvetica-Bold", fontSize: 15 },
  planName: { fontFamily: "Helvetica-Bold", fontSize: 13, letterSpacing: -0.3 },
  planFor: { fontSize: 7.5, color: MUTE, marginTop: 2 },
  planMeta: { fontSize: 7.5, color: MUTE },
  planWhy: { fontSize: 8.5, lineHeight: 1.5, marginTop: 6 },
  totalBand: {
    backgroundColor: BUTTER,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 9 },
  totalValue: { fontFamily: "Helvetica-Bold", fontSize: 20 },
  stepRow: { flexDirection: "row", marginBottom: 14 },
  stepNum: { fontFamily: "Helvetica-Bold", fontSize: 10.5, width: 30 },
  stepText: { fontSize: 10.5 },
  ctaBlock: { backgroundColor: PINK, paddingHorizontal: 26, paddingVertical: 30, marginTop: 24 },
  ctaEyebrow: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 10 },
  ctaBig: { fontFamily: "Helvetica-Bold", fontSize: 30, letterSpacing: -1.2 },
  ctaLink: { fontSize: 7.5, marginTop: 8, color: INK, textDecoration: "underline" },
  footer: { position: "absolute", left: 48, right: 48, bottom: 30 },
  footerText: { fontSize: 6.5, color: MUTE, lineHeight: 1.5 },
});

function Footer({ withLegal = false }: { withLegal?: boolean }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>this is an estimate, not a diagnosis.</Text>
      {withLegal && (
        <Text style={s.footerText}>Treatme Technologies Inc. · not a medical device</Text>
      )}
    </View>
  );
}

function money(n: number | null) {
  return n === null ? "price varies" : `from $${n.toLocaleString("en-CA")}`;
}

/** photo tiles keep the capture's 3:4 shape so normalised marks map straight on */
const TILE_W = 72;
const TILE_H = 96;

/**
 * the same markings as the app, drawn with @react-pdf primitives. there is no
 * blur filter in a pdf, so softness comes from translucency and a wider, fainter
 * copy of each mark underneath.
 */
function ReportMarkers({
  indicator,
  limit = 10,
}: {
  indicator: ReportIndicator;
  limit?: number;
}) {
  const { shapes } = markerDrawing({
    regions: indicator.regions,
    accent: indicator.accent,
    overlayKind: indicator.overlayKind,
    limit,
  });
  if (!shapes.length) return null;

  return (
    <Svg
      viewBox="0 0 1 1"
      style={{ position: "absolute", top: 0, left: 0, width: TILE_W, height: TILE_H }}
    >
      {shapes.map((shape, i) => {
        if (shape.kind === "circle") {
          return (
            <React.Fragment key={i}>
              <Circle
                cx={shape.cx}
                cy={shape.cy}
                r={shape.r * 1.9}
                fill={shape.fill}
                fillOpacity={shape.opacity * 0.35}
              />
              <Circle
                cx={shape.cx}
                cy={shape.cy}
                r={shape.r}
                fill={shape.fill}
                fillOpacity={shape.opacity}
              />
            </React.Fragment>
          );
        }
        if (shape.kind === "line") {
          return (
            <Line
              key={i}
              x1={shape.x1}
              y1={shape.y1}
              x2={shape.x2}
              y2={shape.y2}
              strokeWidth={shape.strokeWidth}
              stroke={shape.stroke}
              strokeOpacity={shape.opacity}
            />
          );
        }
        return (
          <Path
            key={i}
            d={shape.d}
            fill={shape.fill ?? "none"}
            fillOpacity={shape.fill ? shape.opacity : 0}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            strokeOpacity={shape.stroke ? shape.opacity : 0}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

function Tile({ indicator, includePhotos }: { indicator: ReportIndicator; includePhotos: boolean }) {
  const tint = BAND_COLOR[indicator.band];
  if (includePhotos && indicator.photoUrl) {
    // the patient's own photo with the marked places, the same as on screen
    return (
      <View
        style={[
          s.tile,
          { width: TILE_W, height: TILE_H, backgroundColor: tint, position: "relative" },
        ]}
      >
        <Image src={indicator.photoUrl} style={{ width: TILE_W, height: TILE_H, objectFit: "cover" }} />
        <ReportMarkers indicator={indicator} />
      </View>
    );
  }
  return (
    <View style={[s.tile, { backgroundColor: tint }]}>
      <Text style={s.tileLetter}>{indicator.label.charAt(0)}</Text>
    </View>
  );
}

function DetailRow({
  indicator,
  includePhotos,
}: {
  indicator: ReportIndicator;
  includePhotos: boolean;
}) {
  const clear = indicator.score >= 80;
  return (
    <View style={s.detailRow} wrap={false}>
      <Tile indicator={indicator} includePhotos={includePhotos} />
      <View style={s.detailBody}>
        <View style={s.detailHead}>
          <Text style={s.detailName}>{indicator.label}</Text>
          <View style={[s.pill, { backgroundColor: BAND_COLOR[indicator.band] }]}>
            <Text style={s.pillText}>{indicator.band}</Text>
          </View>
          <Text style={s.detailScore}>{indicator.score}</Text>
        </View>

        <Text style={s.detailBlurb}>{indicator.blurb}</Text>

        {clear ? (
          <>
            <Text style={s.txHead}>no treatment indicated</Text>
            <Text style={s.detailBlurb}>
              {NO_TREATMENT_LINE[indicator.key] ?? NO_TREATMENT_LINE.default}
            </Text>
          </>
        ) : (
          <>
            <Text style={s.txHead}>recommended treatments</Text>
            {indicator.treatments.map((t) => (
              <View key={t.slug} style={s.txRow}>
                <Text style={s.txName}>{t.name}</Text>
                <Text style={s.txMeta}>
                  {money(t.priceFrom)} · {t.downtimeLabel}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

export function SkinReportDocument({
  data,
  includePhotos = true,
}: {
  data: ReportData;
  includePhotos?: boolean;
}) {
  const worst = [...data.indicators].sort((a, b) => a.score - b.score).slice(0, 3);
  const grouped = BAND_ORDER.map((band) => ({
    band,
    items: data.indicators.filter((i) => i.band === band).sort((a, b) => a.score - b.score),
  })).filter((g) => g.items.length > 0);

  return (
    <Document title={`treatme skin analysis report · ${data.name}`} author="Treatme Technologies Inc.">
      {/* page 1 — cover / summary */}
      <Page size="LETTER" style={s.page}>
        <View style={s.between}>
          <Text style={s.wordmark}>
            treatme<Text style={s.wordmarkDot}>.</Text>
          </Text>
          <Text style={s.headerRight}>skin analysis report</Text>
        </View>

        <View style={[s.rule, { marginTop: 14 }]} />
        <View style={s.metaRow}>
          {[
            { label: "name", value: data.name },
            { label: "date of scan", value: data.dateLabel },
            { label: "skin type", value: data.skinType },
            { label: "skin tone", value: data.skinTone },
          ].map((m) => (
            <View key={m.label} style={s.metaCell}>
              <Text style={s.metaLabel}>{m.label}</Text>
              <Text style={s.metaValue}>{m.value}</Text>
            </View>
          ))}
        </View>
        <View style={[s.rule, { marginBottom: 18 }]} />

        <View style={[s.scoreBand, { backgroundColor: BAND_COLOR[data.overallBand] }]}>
          <View style={s.row}>
            <Text style={s.scoreBig}>{data.overall}</Text>
            <Text style={s.scoreOf}>/100</Text>
          </View>
          <View>
            <Text style={s.overallLabel}>overall</Text>
            <Text style={s.overallBand}>{data.overallBand}</Text>
          </View>
        </View>

        <Text style={s.h2}>assessment summary</Text>
        <Text style={[s.body, { marginBottom: 24 }]}>{data.summary}</Text>

        <Text style={s.h2}>primary findings</Text>
        <View style={s.findingCards}>
          {worst.map((ind, i) => (
            <View
              key={ind.key}
              style={[
                s.findingCard,
                { backgroundColor: BAND_COLOR[ind.band], marginRight: i === worst.length - 1 ? 0 : 12 },
              ]}
            >
              <Text style={s.findingName}>{ind.label}</Text>
              <View>
                <Text style={s.findingScore}>{ind.score}</Text>
                <Text style={s.findingBand}>{ind.band}</Text>
              </View>
            </View>
          ))}
        </View>

        <Footer withLegal />
      </Page>

      {/* page 2 — all 16 indicators */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.eyebrow}>all 16 indicators</Text>
        <Text style={s.display}>your full analysis</Text>

        {grouped.map((group) => (
          <View key={group.band}>
            <View style={s.groupHead}>
              <View style={[s.swatch, { backgroundColor: BAND_COLOR[group.band] }]} />
              <Text style={s.groupLabel}>{group.band}</Text>
              <Text style={s.groupCount}>
                {group.items.length} {group.items.length === 1 ? "indicator" : "indicators"}
              </Text>
            </View>

            {group.items.map((ind) => (
              <View key={ind.key} style={s.barRow}>
                <View style={s.barTop}>
                  <Text style={s.barLabel}>{ind.label}</Text>
                  <Text style={s.barScore}>{ind.score}</Text>
                </View>
                <View style={s.track}>
                  <View
                    style={{
                      width: `${ind.score}%`,
                      backgroundColor: BAND_BAR[ind.band],
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={[s.legend, { marginTop: 22 }]}>
          {BAND_ORDER.map((band) => (
            <View key={band} style={s.legendItem}>
              <View style={[s.swatch, { width: 9, height: 9, backgroundColor: BAND_COLOR[band] }]} />
              <Text style={s.legendLabel}>{band}</Text>
              <Text style={s.legendRange}>{BAND_RANGE[band]}</Text>
            </View>
          ))}
        </View>

        <Footer />
      </Page>

      {/* pages 3 to 6 — category detail */}
      {data.groups.map((group) => (
        <Page key={group.key} size="LETTER" style={s.page}>
          <Text style={s.pageTitle}>{group.label}</Text>
          {group.indicators.map((ind) => (
            <DetailRow key={ind.key} indicator={ind} includePhotos={includePhotos} />
          ))}
          <Footer />
        </Page>
      ))}

      {/* page 7 — the plan */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.eyebrow}>recommended sequence</Text>
        <Text style={s.display}>your plan</Text>

        {data.plan.map((step, i) => (
          <View key={step.position} style={s.planRow} wrap={false}>
            <View
              style={[
                s.numTile,
                { backgroundColor: i === 0 ? PINK : i === 1 ? "#F6B7CF" : i === 2 ? "#F9CCDD" : BUTTER },
              ]}
            >
              <Text style={s.numText}>{step.position}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.between}>
                <View>
                  <Text style={s.planName}>{step.treatmentName}</Text>
                  <Text style={s.planFor}>for {step.forLabel}</Text>
                </View>
                <Text style={s.planMeta}>
                  {money(step.priceFrom)} · {step.downtimeLabel}
                </Text>
              </View>
              <Text style={s.planWhy}>{step.why}</Text>
            </View>
          </View>
        ))}

        <View style={{ position: "absolute", left: 48, right: 48, bottom: 58 }}>
          <View style={s.totalBand}>
            <Text style={s.totalLabel}>estimated total</Text>
            <Text style={s.totalValue}>from ${data.estimatedTotal.toLocaleString("en-CA")}</Text>
          </View>
        </View>

        <Footer />
      </Page>

      {/* page 8 — next steps */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.eyebrow}>how to proceed</Text>
        <Text style={s.display}>next steps</Text>

        {["pick a clinic near you.", "request a time that works.", "they confirm, and you bring this with you."].map(
          (step, i) => (
            <View key={step} style={s.stepRow}>
              <Text style={s.stepNum}>{i + 1}</Text>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ),
        )}

        <View style={s.ctaBlock}>
          <Text style={s.ctaEyebrow}>get scanned</Text>
          <Text style={s.ctaBig}>treatmeapp.com/scan</Text>
          <Link src={data.scanUrl} style={s.ctaLink}>
            {data.scanUrl}
          </Link>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}
