"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BrainCircuit,
  Check,
  ChevronRight,
  Code2,
  Database,
  Instagram,
  Linkedin,
  Menu,
  Send,
  Sparkles,
  Workflow,
  X
} from "lucide-react";

const services = [
  {
    number: "01",
    icon: BrainCircuit,
    title: "Custom software & automation",
    description:
      "Bespoke web and business applications that fit your processes, your people, and your next stage of growth.",
    detail: "Automate repetitive admin, connect your tools, and add AI where it creates real leverage."
  },
  {
    number: "02",
    icon: Database,
    title: "Full ERP systems",
    description:
      "A connected view of your business, shaped around how work actually moves through your organization.",
    detail: "No rigid off-the-shelf workflows. Just the operations system your team can rely on every day."
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Growth & brand",
    description:
      "Marketing strategy and professional photography that help your business reach the right people and earn their attention.",
    detail: "In-house or partner-delivered support, from brand imagery to the campaigns that put it to work."
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
    copy: "Turn repetitive tasks into reliable automations so your team can focus on higher-value work."
  },
  {
    icon: Code2,
    title: "Build for what’s next",
    copy: "Create a flexible foundation that can grow with your business instead of holding it back."
  }
];

const principles = [
  "Fair, transparent pricing for small and growing businesses",
  "Fully custom systems instead of templates and workarounds",
  "A close working relationship with the people doing the work",
  "Ongoing support and maintenance, included as standard"
];

const projects = [
  {
    category: "Operations · Systems",
    title: "Bakery management system",
    description: "A clearer way to coordinate production, inventory, and daily orders.",
    className: "project-bakery"
  },
  {
    category: "Professional services · Software",
    title: "Audit firm software",
    description: "One connected workspace for client work, reporting, and team visibility.",
    className: "project-audit"
  },
  {
    category: "Growth · Digital",
    title: "A better way to grow",
    description: "A tailored digital foundation that connects growth activity with the rest of the business.",
    className: "project-growth"
  }
];

function Logo({ compact = false, light = false }) {
  return (
    <a href="#top" className={`brand-mark ${light ? "brand-mark-light" : ""}`} aria-label="Kedros home">
      <span className="brand-symbol" aria-hidden="true">
        <span className="brand-arrow" />
        <span className="brand-b" />
      </span>
      {!compact && (
        <span className="brand-word">
          KEDR<span>O</span>S
        </span>
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

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSent(true);
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
          <a className="nav-cta" href="#contact">Start a project <ArrowUpRight size={16} /></a>
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
              <h1>Software built<br /><em>around your business.</em></h1>
              <p className="hero-description">
                We build custom software that removes repetitive work, connects your business, and gives your team room to do more.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#contact">Start a project <ArrowUpRight size={17} /></a>
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
              <div className="visual-tag tag-bottom">KEDROS <span>01</span></div>
            </div>
          </div>
          <div className="container hero-scroll">
            <span>Scroll to explore</span>
            <div className="scroll-line"><span /></div>
          </div>
        </section>

        <section className="statement-section" id="about">
          <div className="container statement-grid">
            <p className="eyebrow">What we believe</p>
            <div>
              <p className="statement">
                The best software doesn&apos;t just store information.<br />
                It <span>takes work off your plate.</span>
              </p>
              <div className="statement-foot">
                <span className="statement-rule" />
                <p>We bring the care of a small studio and the capability to build systems that make a measurable difference.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="services-section section-pad" id="services">
          <div className="container">
            <SectionLabel
              eyebrow="What we do"
              title={<>Software that makes<br /><span>business easier.</span></>}
              copy="We turn manual processes into dependable systems — from focused automations to the custom platforms that run an entire operation."
            />
            <div className="services-grid">
              {services.map(({ number, icon: Icon, title, description, detail }) => (
                <article className="service-card" key={title}>
                  <div className="service-top">
                    <span className="service-number">{number}</span>
                    <span className="service-icon"><Icon size={22} strokeWidth={1.6} /></span>
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <p className="service-detail">{detail}</p>
                  <a href="#contact" className="card-link" aria-label={`Learn more about ${title}`}>Discuss your needs <ArrowUpRight size={16} /></a>
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
              <a href="#contact" className="text-link text-link-light">Let&apos;s talk <ArrowUpRight size={16} /></a>
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
              <SectionLabel eyebrow="Selected work" title={<>Useful work for<br /><span>real businesses.</span></>} />
              <p>Just a few examples of the kinds of business challenges we love to solve with custom software. More coming soon.</p>
            </div>
            <div className="projects-grid">
              {projects.map((project, index) => (
                <article className={`project-card ${project.className}`} key={project.title}>
                  <div className="project-art" aria-hidden="true">
                    {index === 0 && <><div className="art-window"><span /><span /><span /></div><div className="art-loaf">⌁</div></>}
                    {index === 1 && <><div className="art-columns"><span /><span /><span /><span /></div><div className="art-check">✓</div></>}
                    {index === 2 && <><div className="art-bars"><span /><span /><span /><span /></div><div className="art-spark">✦</div></>}
                  </div>
                  <div className="project-meta"><span>{project.category}</span><span>0{index + 1}</span></div>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                  <a href="#contact" className="project-link">View project <ArrowUpRight size={16} /></a>
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
              <p>Tell us a little about what you&apos;re building, and we&apos;ll get back to you within two business days.</p>
              <a href="#contact-form" className="text-link contact-call-link">Book a call <ArrowUpRight size={16} /></a>
              <div className="contact-email">
                <span>Prefer email?</span>
                <a href="mailto:info@kedros.dev">info@kedros.dev <ArrowUpRight size={15} /></a>
              </div>
            </div>
            <form className="contact-form" id="contact-form" onSubmit={handleSubmit}>
              {sent ? (
                <div className="form-success">
                  <span className="success-icon"><Check size={22} /></span>
                  <h3>Thanks for reaching out.</h3>
                  <p>This is a frontend preview for now. Your message hasn&apos;t been sent, but the form is ready to connect when you are.</p>
                  <button type="button" className="text-link" onClick={() => setSent(false)}>Send another message <ArrowUpRight size={16} /></button>
                </div>
              ) : (
                <>
                  <label>Name<input type="text" name="name" placeholder="Your name" required /></label>
                  <label>Email<input type="email" name="email" placeholder="you@company.com" required /></label>
                  <label>How can we help?<textarea name="message" placeholder="Tell us a little about your project..." rows="4" required /></label>
                  <button className="button button-primary form-submit" type="submit">Send enquiry <Send size={16} /></button>
                  <p className="form-note">No sales pitch. Just a useful first conversation.</p>
                </>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-top">
          <Logo light />
          <p>Custom software for the<br />way your business works.</p>
          <a className="footer-cta" href="#contact">Start a project <ArrowUpRight size={16} /></a>
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
