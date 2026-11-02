import { Component, type ReactNode } from 'react'

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

// Bilingual on purpose: this class-component fallback renders outside the normal hooks flow.
function Fallback({ detail }: { detail?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg p-6">
      <div className="max-w-[460px] rounded-lg border border-warn/40 bg-warn/[0.06] p-4 text-[13px] leading-relaxed text-ink-2">
        <div className="mb-1 font-semibold text-warn">3D view unavailable: WebGL is disabled in this browser</div>
        <div className="mb-2 text-warn/90">৩D ভিউ দেখা যাচ্ছে না: এই ব্রাউজারে WebGL বন্ধ আছে। নিচের ধাপগুলো অনুসরণ করুন।</div>
        <p>The simulation, controls, code inspector and timeline still work. To see the 3D elevator:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Chrome: Settings → System → turn on <b className="text-ink">“Use graphics acceleration when available”</b>, then Relaunch.
          </li>
          <li>
            Check <span className="font-mono text-ink">chrome://gpu</span>: “WebGL” should say <i>Hardware accelerated</i>.
          </li>
          <li>Or open this page in Safari.</li>
        </ol>
        {detail && <p className="mt-2 font-mono text-[11px] break-words text-faint">{detail}</p>}
      </div>
    </div>
  )
}

/** Keeps a WebGL failure from blanking the whole app. */
export class WebGLGuard extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = webglAvailable() ? {} : { error: 'No WebGL context could be created.' }
  static getDerivedStateFromError(e: Error) {
    return { error: e.message }
  }
  render() {
    return this.state.error ? <Fallback detail={this.state.error} /> : this.props.children
  }
}
