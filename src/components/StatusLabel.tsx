import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  Wrench,
  XCircle,
} from 'lucide-react';

interface StatusLabelProps {
  status: string;
}

export function StatusLabel({ status }: StatusLabelProps) {
  const s = status.trim();

  if (
    s === 'Completed' ||
    s === 'Available' ||
    s === 'Paid' ||
    s === 'Active' ||
    s === 'Reviewed - No Penalty'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-[#2E7D32]/25 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{s}</span>
      </span>
    );
  }

  if (s === 'Running' || s === 'On Trip' || s === 'Approved') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E87524]/45 bg-[#E87524]/22 px-2.5 py-0.5 text-[11px] font-semibold text-[#FFE4C4] whitespace-nowrap">
        <PlayCircle className="h-3 w-3 shrink-0 text-[#E87524]" aria-hidden="true" />
        <span>{s}</span>
      </span>
    );
  }

  if (s === 'Maintenance') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D99A32]/45 bg-[#D99A32]/22 px-2.5 py-0.5 text-[11px] font-semibold text-[#FDE68A] whitespace-nowrap">
        <Wrench className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{s}</span>
      </span>
    );
  }

  if (
    s === 'Scheduled' ||
    s === 'Pending Approval' ||
    s === 'Pending Review' ||
    s === 'On Leave'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D99A32]/45 bg-[#D99A32]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#FDE68A] whitespace-nowrap">
        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{s}</span>
      </span>
    );
  }

  if (s === 'Delayed' || s === 'Reviewed - Escalated') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-[#9F2B2B]/35 px-2.5 py-0.5 text-[11px] font-semibold text-red-200 whitespace-nowrap">
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{s}</span>
      </span>
    );
  }

  if (s === 'Cancelled' || s === 'Inactive') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#56352B]/60 bg-[#211B19]/75 px-2.5 py-0.5 text-[11px] font-semibold text-[#D6C1AA] whitespace-nowrap">
        <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{s}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-[#D99A32]/30 bg-[#481D22]/70 px-2.5 py-0.5 text-[11px] font-semibold text-[#FFF1DC] whitespace-nowrap">
      {s}
    </span>
  );
}
