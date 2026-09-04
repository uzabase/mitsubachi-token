import React from "react";

/**
 * アドオン組み込みの Color プレゼンタの差し替え。
 *
 * 組み込みのものは background を敷くだけなので、白に近い色と透明な色が
 * 背景に溶けて見えない。枠線と市松模様を足す。
 *
 * DesignTokenDocBlock の presenters prop に渡すと PresenterMap を上書きできる。
 */

interface Token {
  value: string;
}

// 透明・半透明を可視化する市松模様。elevation の inverse は Light で完全に透明なので、
// これが無いと「値が無い」のか「透明」なのか区別できない。
const CHECKERBOARD: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #d0d0d0 25%, transparent 25%), " +
    "linear-gradient(-45deg, #d0d0d0 25%, transparent 25%), " +
    "linear-gradient(45deg, transparent 75%, #d0d0d0 75%), " +
    "linear-gradient(-45deg, transparent 75%, #d0d0d0 75%)",
  backgroundSize: "10px 10px",
  backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0px",
  backgroundColor: "#ffffff",
};

function ColorPresenter({ token }: { token: Token }) {
  return (
    <div style={{ ...CHECKERBOARD, height: 32, width: "100%", borderRadius: 2 }}>
      <div
        style={{
          background: token.value,
          borderRadius: 2,
          height: "100%",
          width: "100%",
          // ライト・ダークどちらの背景でも見えるように中間色で縁取る。
          // border ではなく inset shadow にして、色の面積を削らないようにする。
          boxShadow: "inset 0 0 0 1px rgba(128, 128, 128, 0.6)",
        }}
      />
    </div>
  );
}

export const presenters = { Color: ColorPresenter };
