/**
 * drawing.ts — deepentropy/lightweight-charts-drawing re-export
 *
 * R5a 채택: lightweight-charts-drawing@0.1.1 (MIT, deepentropy)
 * 사유: DrawingManager + TrendLine + HorizontalLine + on('drawing:added') 콜백 완비.
 *       hook 없음, peer dep = lightweight-charts^5.0.0 (chartalert 사용 버전과 일치).
 *
 * Chart.tsx 는 이 파일 대신 lightweight-charts-drawing 을 직접 import 해도 무방.
 * 이 파일은 tree-shaking 을 위한 re-export 레이어로 유지.
 */

export {
  DrawingManager,
  TrendLine,
  HorizontalLine,
  HorizontalRay,
} from 'lightweight-charts-drawing'

export type {
  IDrawing,
  Anchor,
  DrawingEvent,
  DrawingEventType,
  DrawingEventCallback,
} from 'lightweight-charts-drawing'
