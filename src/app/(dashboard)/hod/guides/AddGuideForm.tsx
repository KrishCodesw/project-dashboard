import { addGuide } from "@/server/actions/hod-dashboard";

export function AddGuideForm() {
  return (
    <form action={addGuide} className="space-y-3">
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-muted-foreground mb-1">
          Faculty Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm"
          placeholder="faculty@tcetmumbai.in"
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center justify-center h-9 px-4 rounded-sm text-[10px] font-mono uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent transition-all duration-300"
      >
        Add Guide
      </button>
    </form>
  );
}
