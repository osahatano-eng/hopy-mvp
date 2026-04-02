"use client";

export default function Philosophy({ title, body }: { title: string; body: string[] }) {
  return (
    <div className="phi">
      <div className="phi-top">
        <div className="eyebrow">PHILOSOPHY</div>
        <h2 className="h2">{title}</h2>
      </div>

      <div className="phi-body">
        {body.map((line, i) => (
          <p key={i} className="phi-line">
            {line}
          </p>
        ))}
      </div>

      <div className="phi-divider" aria-hidden />
    </div>
  );
}
