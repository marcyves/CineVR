export class TitleSlate {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private t = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1280;
    this.canvas.height = 720;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible");
    this.ctx = ctx;
  }

  draw(timeMs: number, title: string, subtitle: string, status: string): void {
    this.t = timeMs * 0.001;
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#07060c";
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 40, w * 0.5, h * 0.5, 520);
    g.addColorStop(0, "rgba(196, 149, 74, 0.28)");
    g.addColorStop(0.45, "rgba(88, 40, 120, 0.16)");
    g.addColorStop(1, "rgba(7, 6, 12, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#e8c07a";
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const y = ((i * 46 + this.t * 22) % (h + 40)) - 20;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(232, 192, 122, 0.45)";
    ctx.lineWidth = 8;
    ctx.strokeRect(36, 36, w - 72, h - 72);
    ctx.lineWidth = 1;
    ctx.strokeRect(52, 52, w - 104, h - 104);

    ctx.fillStyle = "#e8c07a";
    ctx.font = "600 28px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CINÉ VR  ·  QUEST 2", w / 2, 140);

    ctx.fillStyle = "#f6f1e6";
    ctx.font = "600 84px Fraunces, Georgia, serif";
    ctx.fillText(title, w / 2, 320);

    ctx.fillStyle = "rgba(246, 241, 230, 0.72)";
    ctx.font = "400 28px 'DM Sans', sans-serif";
    ctx.fillText(subtitle, w / 2, 380);

    ctx.fillStyle = "#c4b5fd";
    ctx.font = "500 22px 'DM Sans', sans-serif";
    ctx.fillText(status, w / 2, 560);

    const pulse = 0.5 + Math.sin(this.t * 3) * 0.5;
    ctx.fillStyle = `rgba(232, 192, 122, ${0.15 + pulse * 0.25})`;
    ctx.beginPath();
    ctx.arc(w / 2, 620, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}
