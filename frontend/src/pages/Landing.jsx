// VistaraX - Public landing page. This is intentionally the very first
// stop for any link into the app: Landing -> Login -> Dashboard. It never
// auto-redirects a signed-in visitor away (they can simply click "Go to
// Dashboard"), so the flow the product asked for always holds.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Sparkles, Camera, DoorOpen, Bell, BarChart3, KeyRound, MapPin,
  UploadCloud, Download, LayoutDashboard, ShieldCheck, Linkedin, Menu, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  { icon: Camera, title: 'Photo Check-In', desc: 'Every visitor is photographed the moment they arrive, tied straight to their record.' },
  { icon: DoorOpen, title: 'Currently Inside', desc: 'A live, always-accurate view of exactly who is on the premises right now.' },
  { icon: Bell, title: 'Real-Time Alerts', desc: 'Front desk staff get an instant notification the second someone checks in.' },
  { icon: BarChart3, title: 'Audit-Ready Reports', desc: 'Exact check-in/out times, locations and remarks - exportable in one click.' },
  { icon: KeyRound, title: 'Role-Based Access', desc: 'Admins, managers and entry staff each see exactly what their role allows.' },
  { icon: MapPin, title: 'Geo-Tagged Entries', desc: 'Capture the precise location of a check-in, with a direct link to the map.' },
  { icon: UploadCloud, title: 'Bulk Staff Import', desc: 'Onboard an entire team in one CSV or Excel upload - no manual re-typing.' },
  { icon: Download, title: 'Multi-Format Export', desc: 'Download the visitor register as CSV, Excel or a print-ready PDF.' },
];

const STAT_TILES = [
  { icon: Camera, title: 'Photo-Verified Check-ins', desc: 'Every visitor photographed the moment they arrive.' },
  { icon: LayoutDashboard, title: 'Live Front-Desk Dashboard', desc: 'Real-time counts, activity charts and recent entries.' },
  { icon: ShieldCheck, title: 'Role-Based Security', desc: 'JWT auth, bcrypt hashing and per-role permissions throughout.' },
];

const LEADERSHIP = [
  { name: 'G.B Singh', role: 'Chairman', photo: '/team/gb-singh.jpg' },
  { name: 'Gian Singh', role: 'Managing Director', photo: '/team/gian-singh.jpg' },
  { name: 'Vijay Sharma', role: 'IT Head', initials: 'VS' },
];

const TEAM = [
  {
    name: 'Satyajit Nayak',
    role: 'Lead Developer',
    photo: '/team/satyajit-nayak.jpg',
    bio: 'Designs and builds VistaraX end-to-end — every module, screen and integration in this system.',
  },
  {
    name: 'Gian Singh',
    role: 'Managing Director',
    photo: '/team/gian-singh.jpg',
    bio: 'Sets the direction for the Jawandsons Group and the systems, like VistaraX, that run it.',
  },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);

  const primaryLabel = user ? 'Go to Dashboard' : 'Sign In to Dashboard';
  const primaryTarget = user ? '/dashboard' : '/login';

  return (
    <div className="min-h-screen bg-base-950 bg-grid-glow text-slate-200">
      {/* NAV */}
      <header className="sticky top-0 z-40 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/vistarax-logo.png" alt="VistaraX" className="h-9 w-9 rounded-xl shadow-glow shrink-0" />
            <div>
              <p className="font-bold text-white leading-none">VistaraX</p>
              <p className="text-[10px] text-slate-500 tracking-wide mt-0.5">VISITOR INTELLIGENCE</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition">What's Inside</a>
            <a href="#about" className="hover:text-white transition">About</a>
            <a href="#team" className="hover:text-white transition">Team</a>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate(primaryTarget)} className="hidden sm:inline-flex btn-primary text-sm px-5 py-2">
              {primaryLabel}
            </button>
            <button
              onClick={() => setMobileNav((o) => !o)}
              className="md:hidden h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition"
              aria-label="Toggle menu"
            >
              {mobileNav ? <X size={18} className="text-slate-300" /> : <Menu size={18} className="text-slate-300" />}
            </button>
          </div>
        </div>

        {mobileNav && (
          <div className="md:hidden border-t border-white/10 px-4 py-4 space-y-3 glass animate-fade-in">
            <a href="#features" onClick={() => setMobileNav(false)} className="block text-sm text-slate-300 hover:text-white">What's Inside</a>
            <a href="#about" onClick={() => setMobileNav(false)} className="block text-sm text-slate-300 hover:text-white">About</a>
            <a href="#team" onClick={() => setMobileNav(false)} className="block text-sm text-slate-300 hover:text-white">Team</a>
            <button onClick={() => navigate(primaryTarget)} className="btn-primary w-full text-sm py-2.5">{primaryLabel}</button>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent-blue/20 blur-[120px]" />
        <div className="absolute top-40 -right-32 h-96 w-96 rounded-full bg-accent-violet/20 blur-[120px]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 items-center relative">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-accent-blue bg-accent-blue/10 border border-accent-blue/30 px-3 py-1.5 rounded-full">
              <Sparkles size={12} /> Visitor Intelligence Platform
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white mt-5 leading-tight">
              Run every check-in,<br />every visitor,<br />
              <span className="text-gradient">from one dashboard.</span>
            </h1>
            <p className="text-slate-400 mt-5 text-base sm:text-lg max-w-md">
              VistaraX is the front-desk operating system built in-house for the Jawandsons Group — photo verification, live tracking and audit-ready reports, in one secure portal.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <button onClick={() => navigate(primaryTarget)} className="btn-primary flex items-center gap-2 px-6 py-3 text-sm">
                {primaryLabel} <ArrowRight size={16} />
              </button>
              <a href="#features" className="btn-secondary flex items-center gap-2 px-6 py-3 text-sm">See what's inside</a>
            </div>
          </div>

          {/* Mock dashboard preview - a lightweight, static echo of the real
              dashboard so the hero never needs a live API call. */}
          <div className="relative animate-fade-in">
            <div className="glass-strong rounded-2xl shadow-glass p-5">
              <div className="flex items-center gap-1.5 mb-4">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[{ l: 'Today', v: 24 }, { l: 'Inside', v: 7 }, { l: 'This Month', v: 318 }].map((s) => (
                  <div key={s.l} className="card p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{s.l}</p>
                    <p className="text-lg font-bold text-white mt-1">{s.v}</p>
                  </div>
                ))}
              </div>
              <div className="card p-4 mb-3">
                <div className="flex items-end gap-2 h-20">
                  {[40, 65, 35, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-accent-blue to-accent-cyan" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="card p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-2 w-24 bg-white/10 rounded" />
                  <div className="h-2 w-16 bg-white/5 rounded mt-1.5" />
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">Inside</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold tracking-widest uppercase text-accent-violet">What's Inside</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3">Everything the front desk needs, built in.</h2>
          <p className="text-slate-400 mt-3">No paper registers, no separate spreadsheets. Just one portal that runs reception.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 hover:border-white/20 transition">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-violet/10 flex items-center justify-center text-accent-blue mb-3">
                <f.icon size={20} />
              </div>
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ABOUT / WHO WE ARE */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20">
        <div className="card p-6 sm:p-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center bg-gradient-to-br from-accent-blue/5 via-transparent to-accent-violet/5">
          <div>
            <span className="text-xs font-semibold tracking-widest uppercase text-accent-blue">Who We Are</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-3">Built in-house, for how the front desk actually works.</h2>
            <p className="text-slate-400 mt-4 leading-relaxed text-sm sm:text-base">
              VistaraX is operated by the Jawandsons Group's own technology team. Instead of paper logbooks and disconnected spreadsheets, every visitor is photographed, verified and tracked in one secure system — so reception, security and administration always see the same source of truth.
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {['Visitor Management', 'Built In-House', 'Role-Based Security'].map((t) => (
                <span key={t} className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300">{t}</span>
              ))}
            </div>
          </div>
          <div className="card p-8 flex flex-col items-center text-center bg-base-900/60">
            <img src="/vistarax-logo.png" alt="VistaraX" className="h-16 w-16 rounded-2xl shadow-glow mb-4" />
            <p className="text-white font-semibold">One system, every visitor,<br />always verified.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          {STAT_TILES.map((s) => (
            <div key={s.title} className="card p-5 flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-cyan/10 flex items-center justify-center text-accent-cyan shrink-0">
                <s.icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* GROUP LEADERSHIP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold tracking-widest uppercase text-accent-violet">Group Leadership</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3">Guided from the top.</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {LEADERSHIP.map((p) => (
            <div key={p.name} className="card p-6 text-center">
              <div className="h-28 w-28 rounded-2xl overflow-hidden mx-auto border border-white/10 bg-white/5">
                {p.photo ? (
                  <img src={p.photo} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-white bg-gradient-to-br from-accent-blue to-accent-violet">
                    {p.initials}
                  </div>
                )}
              </div>
              <h3 className="text-white font-semibold mt-4">{p.name}</h3>
              <p className="text-xs text-accent-blue font-medium mt-0.5">{p.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TEAM */}
      <section id="team" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold tracking-widest uppercase text-accent-blue">The People Behind It</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3">Small team, direct accountability.</h2>
          <p className="text-slate-400 mt-3">No layers, no hand-offs — the people who build VistaraX and the people who run it are both reachable.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {TEAM.map((p) => (
            <div key={`${p.name}-${p.role}`} className="card p-6 text-center">
              <div className="h-24 w-24 rounded-full overflow-hidden mx-auto border-2 border-accent-blue/40">
                <img src={p.photo} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <h3 className="text-white font-semibold mt-4">{p.name}</h3>
              <p className="text-xs text-accent-blue font-medium mt-0.5">{p.role}</p>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{p.bio}</p>
              <div className="flex justify-center mt-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Linkedin size={13} /> LinkedIn
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="glass-strong rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-glass">
          <div>
            <span className="text-xs font-semibold tracking-widest uppercase text-emerald-400">Ready when you are</span>
            <h3 className="text-2xl font-bold text-white mt-2">Sign in to your VistaraX account</h3>
            <p className="text-sm text-slate-400 mt-1">Your dashboard, today's visitors and your team are waiting on the other side.</p>
          </div>
          <button onClick={() => navigate(primaryTarget)} className="btn-primary flex items-center gap-2 px-6 py-3 text-sm shrink-0">
            {primaryLabel} <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/vistarax-logo.png" alt="VistaraX" className="h-6 w-6 rounded-md" />
            <span className="text-sm text-slate-400">VistaraX</span>
          </div>
          <p className="text-xs text-slate-600 text-center">© {new Date().getFullYear()} VistaraX. A Jawandsons Group company. All rights reserved.</p>
          <button onClick={() => navigate('/login')} className="text-xs text-accent-blue hover:underline">Sign In →</button>
        </div>
      </footer>
    </div>
  );
}
