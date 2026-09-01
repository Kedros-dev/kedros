"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BrainCircuit,
  Check,
  ChevronRight,
  ChevronDown,
  Code2,
  Instagram,
  Linkedin,
  Menu,
  Send,
  Workflow,
  X
} from "lucide-react";

const BOOKING_URL = "https://cal.com/jasongreich/demo";

function AutomationMark() {
  return <svg viewBox="0 0 56 56" aria-hidden="true" focusable="false"><path d="M28 10v5M25 10h6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" /><rect x="10" y="16" width="36" height="29" rx="9" fill="none" stroke="currentColor" strokeWidth="2.8" /><circle cx="21" cy="29" r="3.2" fill="#642dd4" /><circle cx="35" cy="29" r="3.2" fill="#642dd4" /><path d="M20 37c4 3 12 3 16 0" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" /></svg>;
}

function SystemsMark() {
  return <svg viewBox="0 0 56 56" aria-hidden="true" focusable="false"><path d="M8 25 28 11l20 14v21H8V25Z" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" /><path d="M16 46V28h24v18M16 34h24M28 28v18" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M23 19h10" fill="none" stroke="#642dd4" strokeWidth="3" strokeLinecap="round" /></svg>;
}

function GrowthMark() {
  return <svg viewBox="0 0 56 56" aria-hidden="true" focusable="false"><path d="M9 44h38M12 39V16" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" /><path d="m14 36 9-9 7 5 13-15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path d="M35 17h8v8" fill="none" stroke="#642dd4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="23" cy="27" r="2.6" fill="#642dd4" /></svg>;
}

const services = [
  {
    number: "01",
    icon: AutomationMark,
    title: "Custom Software & Automation",
    description:
      "Bespoke internal tools, dashboards, and automations built around your workflow.",
    detail: "Automate repetitive admin and connect the tools you already use.",
    tags: ["Internal tools", "Dashboards", "Integrations"]
  },
  {
    number: "02",
    icon: SystemsMark,
    title: "Full ERP Systems",
    description:
      "A connected operating system for orders, inventory, approvals, and reporting.",
    detail: "No rigid templates — just the system your business actually needs.",
    tags: ["Orders", "Inventory", "Reporting"]
  },
  {
    number: "03",
    icon: GrowthMark,
    title: "Digital Growth Systems",
    description:
      "Websites, landing pages, and content systems that support growth.",
    detail: "Built in-house or with trusted partners, depending on the project.",
    tags: ["Websites", "Landing pages", "Campaigns"]
  }
];

const automationPoints = [
  {
    icon: Workflow,
    title: "Connect the moving parts",
    copy: "Bring the tools your team already uses into one clear, connected workflow."
  },
  {
    icon: BrainCircuit,
    title: "Remove the busywork",
    copy: "Automate recurring admin, reminders, updates, reports, and handoffs."
  },
  {
    icon: Code2,
    title: "Build for what’s next",
    copy: "Create a flexible system that grows with your team instead of forcing workarounds."
  }
];

const principles = [
  "Fair, transparent pricing for small and growing businesses",
  "Fully custom systems instead of templates and workarounds",
  "A close working relationship with the people doing the work",
  "Ongoing support and maintenance, included as standard"
];

const industries = [
  {
    category: "Food & hospitality · Software",
    title: "Food & hospitality",
    description: "Production planning, inventory tracking, supplier orders, catering workflows, and daily operational dashboards.",
    className: "project-bakery"
  },
  {
    category: "Professional services · Software",
    title: "Professional services",
    description: "Client workspaces, approvals, reporting, task tracking, document workflows, and team visibility.",
    className: "project-audit"
  },
  {
    category: "Retail & growth · Digital",
    title: "Retail & growing businesses",
    description: "Customer journeys, sales workflows, marketing operations, stock visibility, and growth dashboards.",
    className: "project-growth"
  }
];

function Logo({ compact = false, light = false }) {
  return (
    <a href="#top" className={`brand-mark ${light ? "brand-mark-light" : ""}`} aria-label="Kedros home">
      {light ? (
        <>
          <span className="brand-symbol" aria-hidden="true">
            <span className="brand-arrow" />
            <span className="brand-b" />
          </span>
          {!compact && (
            <span className="brand-word">
              KEDR<span>O</span>S
            </span>
          )}
        </>
      ) : (
        <>
          <img className="brand-symbol-image" src="/assets/kedros-symbol-brand.png" alt="" />
          {!compact && <img className="brand-wordmark-image" src="/assets/kedros-wordmark-brand.png" alt="Kedros Business Development" />}
        </>
      )}
    </a>
  );
}

function SectionLabel({ eyebrow, title, copy, light = false }) {
  return (
    <div className={`section-heading ${light ? "section-heading-light" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {copy && <p className="section-copy">{copy}</p>}
    </div>
  );
}

const processSteps = [
  ["Understand your workflow", "We map how your team actually works before suggesting a solution."],
  ["Design the right system", "We define the tools, automations, and interfaces your business needs."],
  ["Build and launch", "We develop, test, and launch the system with your team’s real use cases in mind."],
  ["Support and improve", "We stay involved after launch so the system keeps working as your business grows."]
];

const workflowTransforms = [
  ["Repetitive admin", "Automated workflows"],
  ["Scattered tools", "Connected operations"],
  ["Manual handoffs", "Clear visibility"]
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedService, setExpandedService] = useState(null);
  const [expandedProcess, setExpandedProcess] = useState(null);
  const [formNotice, setFormNotice] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    // TODO: Connect this form to the agreed enquiry endpoint or CRM when backend work is in scope.
    setFormNotice(true);
  };
  return (
    <div className="site-shell" id="top">
      <header className="site-header">
        <div className="container nav-wrap">
          <Logo />
          <nav className={`main-nav ${menuOpen ? "main-nav-open" : ""}`} aria-label="Main navigation">
            <a href="#services" onClick={closeMenu}>Services</a>
            <a href="#about" onClick={closeMenu}>Why Kedros</a>
            <a href="#work" onClick={closeMenu}>Our work</a>
            <a href="#contact" onClick={closeMenu}>Contact</a>
            <Link href="/login" onClick={closeMenu}>Client login</Link>
          </nav>
          <a className="nav-cta" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Start a project <ArrowUpRight size={16} /></a>
          <button
            className="menu-toggle"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-grid-glow" aria-hidden="true" />
          <div className="container hero-content">
            <div className="hero-copy">
              <p className="eyebrow hero-eyebrow"><span className="eyebrow-line" /> Independent software studio</p>
              <h1>Software built<br /><em>around your<br />business.</em></h1>
              <p className="hero-description">
                We build custom tools, automations, and business systems that remove repetitive work, connect your operations, and give your team room to do more.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Start a project <ArrowUpRight size={17} /></a>
                <a className="text-link" href="#services">Explore our services <ChevronRight size={16} /></a>
              </div>
              <div className="hero-note">
                <span className="note-dot" />
                <span>Automate the repetitive. Focus on the important.</span>
              </div>
            </div>
            <div className="hero-visual" aria-label="Kedros business development">
              <div className="visual-orbit orbit-one" />
              <div className="visual-orbit orbit-two" />
              <div className="visual-square square-one" />
              <div className="visual-square square-two" />
              <div className="hero-emblem">
                <img src="/assets/kedros-symbol.png" alt="" />
              </div>
              <div className="visual-tag tag-top"><span /> Built for the way you work</div>
            </div>
          </div>
          <div className="container hero-scroll">
            <span>Scroll to explore</span>
            <div className="scroll-line"><span /></div>
          </div>
        </section>

        <section className="statement-section" id="about">
          <div className="container statement-grid">
            <div className="statement-aside">
              <p className="eyebrow">What we believe</p>
              <p className="statement">
                <span className="statement-lead">The best software doesn&apos;t just store information.</span><br />
                <span>It takes work off your plate.</span>
              </p>
              <p className="statement-support">We combine the care of a small studio with the technical depth to turn repetitive work, scattered tools, and manual handoffs into systems your team can rely on.</p>
            </div>
            <div className="statement-main">
              <div className="workflow-map" aria-label="Kedros turns manual work into connected systems">
                <div className="workflow-core"><img src="/assets/kedros-symbol-brand.png" alt="" /></div>
                <div className="workflow-orbit workflow-orbit-one" aria-hidden="true" />
                <div className="workflow-orbit workflow-orbit-two" aria-hidden="true" />
                {workflowTransforms.map(([before, after], index) => (
                  <div className={`workflow-row workflow-row-${index + 1}`} key={before}>
                    <div className="workflow-state workflow-before"><small>From</small><span>{before}</span></div>
                    <div className="workflow-path" aria-hidden="true"><i /></div>
                    <div className="workflow-state workflow-after"><small>To</small><span>{after}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="services-section section-pad" id="services">
          <div className="container">
            <div className="services-intro-row">
              <SectionLabel
                eyebrow="What we do"
                title={<>Software that makes <span>business easier.</span></>}
                copy="We turn manual processes into dependable systems, from focused automations to the custom platforms that run an entire operation."
              />
            </div>
            <div className="services-grid">
              {services.map(({ number, icon: Icon, title, description, detail, tags }) => (
                <article className={`service-card ${expandedService === number ? "is-expanded" : ""}`} key={title}>
                  <div className="service-top">
                    <span className="service-number">{number}</span>
                    <span className="service-icon"><Icon size={21} strokeWidth={1.6} /></span>
                  </div>
                  <div className="service-body">
                    <h3>{title}</h3>
                    <div className="service-tags" aria-label={`${title} examples`}>
                      {tags.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                    <button className="service-expand" type="button" aria-expanded={expandedService === number} onClick={() => setExpandedService(expandedService === number ? null : number)}>
                      {expandedService === number ? "Hide details" : "View details"}<ChevronDown size={15} />
                    </button>
                    <div className={`service-details ${expandedService === number ? "is-visible" : ""}`}>
                        <p>{description}</p>
                        <p className="service-detail">{detail}</p>
                        <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="card-link" aria-label={`Discuss ${title}`}>Discuss your needs <ArrowUpRight size={16} /></a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="automation-section section-pad">
          <div className="container automation-grid">
            <SectionLabel
              eyebrow="The software advantage"
              title={<>Stop doing work<br /><span>software can handle.</span></>}
              copy="A smarter workflow is not about adding more tools. It is about making the right work happen automatically, in the background."
            />
            <div className="automation-points">
              {automationPoints.map(({ icon: Icon, title, copy }, index) => (
                <div className="automation-point" key={title}>
                  <div className="automation-icon"><Icon size={20} strokeWidth={1.7} /></div>
                  <div>
                    <span className="automation-index">0{index + 1}</span>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="value-section section-pad">
          <div className="container value-grid">
            <div className="value-intro">
              <p className="eyebrow">Why Kedros</p>
              <h2>More done.<br /><span>Less repeated.</span></h2>
              <p>Good software should move your business forward — not make you change the way you work to fit it.</p>
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="text-link text-link-light">Let&apos;s talk <ArrowUpRight size={16} /></a>
            </div>
            <div className="principles-list">
              {principles.map((principle, index) => (
                <div className="principle" key={principle}>
                  <span className="principle-number">0{index + 1}</span>
                  <p>{principle}</p>
                  <span className="principle-check"><Check size={15} /></span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="work-section section-pad" id="work">
          <div className="container">
            <div className="work-heading">
              <SectionLabel eyebrow="Industries we support" title={<>Software for the way<br /><span>your industry works.</span></>} />
            </div>
            <div className="projects-grid">
              {industries.map((industry, index) => (
                <article className={`project-card ${industry.className}`} key={industry.title}>
                  <div className="project-art" aria-hidden="true">
                    {index === 0 && <><div className="art-window"><span /><span /><span /></div><div className="art-loaf">⌁</div></>}
                    {index === 1 && <><div className="art-columns"><span /><span /><span /><span /></div><div className="art-check">✓</div></>}
                    {index === 2 && <><div className="art-bars"><span /><span /><span /><span /></div><div className="art-spark">✦</div></>}
                  </div>
                  <h3>{industry.title}</h3>
                  <p>{industry.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="process-section section-pad">
          <div className="container">
            <SectionLabel eyebrow="A clear way forward" title={<>How we <span>work.</span></>} copy="A focused process keeps a custom build practical, visible, and grounded in the work it needs to support." />
            <div className="process-grid">
              {processSteps.map(([title, copy], index) => (
                <article className={`process-step ${expandedProcess === index ? "is-expanded" : ""}`} key={title}>
                  <button className="process-step-head" type="button" aria-expanded={expandedProcess === index} onClick={() => setExpandedProcess(expandedProcess === index ? null : index)}>
                    <span className="process-number">0{index + 1}</span>
                    <span className="process-step-title">{title}</span>
                    <ChevronDown size={16} />
                  </button>
                  <div className="process-detail"><p>{copy}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="contact-section section-pad" id="contact">
          <div className="container contact-grid">
            <div className="contact-intro">
              <p className="eyebrow">Start a conversation</p>
              <h2>Have a good<br /><span>idea?</span> Let&apos;s talk.</h2>
              <p>Tell us a little about what you&apos;re building. We&apos;ll use it to make the first conversation useful.</p>
              <a href="#contact-form" className="text-link contact-call-link">Book a call <ArrowUpRight size={16} /></a>
              <div className="contact-email">
                <span>Prefer email?</span>
                <a href="mailto:info@kedros.dev">info@kedros.dev <ArrowUpRight size={15} /></a>
              </div>
            </div>
            <form className="contact-form" id="contact-form" onSubmit={handleSubmit}>
              <label>Name<input type="text" name="name" placeholder="Your name" required /></label>
              <label>Email<input type="email" name="email" placeholder="you@company.com" required /></label>
              <label>How can we help?<textarea name="message" placeholder="Tell us a little about your project..." rows="4" required /></label>
              <button className="button button-primary form-submit" type="submit">Send enquiry <Send size={16} /></button>
              <p className="form-note">No sales pitch. Just a useful first conversation.</p>
              {formNotice && <p className="form-integration-note" role="status">Enquiry sending will be connected when the contact workflow is ready.</p>}
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-top">
          <Logo light />
          <p>Custom software for the<br />way your business works.</p>
          <a className="footer-cta" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Start a project <ArrowUpRight size={16} /></a>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Kedros. All rights reserved.</span>
          <div className="social-links">
            <a href="#contact" aria-label="LinkedIn"><Linkedin size={16} /></a>
            <a href="#contact" aria-label="Instagram"><Instagram size={16} /></a>
          </div>
          <span>Made for businesses with ambition.</span>
        </div>
      </footer>
    </div>
  );
}
