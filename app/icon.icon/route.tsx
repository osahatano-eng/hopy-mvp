// /app/icon.png/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* inner container MUST declare display when it has multiple children */}
        <div
          style={{
            width: 280,
            height: 280,
            position: "relative",
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 64,
              height: 280,
              background: "#fff",
              borderRadius: 10,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 64,
              height: 280,
              background: "#fff",
              borderRadius: 10,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 120,
              width: 280,
              height: 48,
              background: "#fff",
              borderRadius: 10,
            }}
          />
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
