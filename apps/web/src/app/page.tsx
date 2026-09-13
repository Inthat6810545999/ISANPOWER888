import Link from "next/link";
import { LabScene } from "@/components/landing/LabScene";
import { Reveal } from "@/components/landing/Reveal";
import styles from "@/components/landing/landing.module.css";

const steps = [
  { title: "Make a request.", text: "Sign in with your lab account. Tell us what you need, where you need it, and when." },
  { title: "Let the team coordinate.", text: "A TA picks up your request. When approval is needed, a Lab Manager reviews it before work begins." },
  { title: "Follow the progress.", text: "Check your workspace for updates, from assignment to work in progress and completion." },
];

export default function Home() {
  return (
    <div className={styles.landing} id="top">
      <a className={styles.skip} href="#overview">Skip to overview</a>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="ISANPOWER888 LAB home"><span className={styles.brandMark} aria-hidden="true">✳</span> ISANPOWER888<span className={styles.brandLight}> / LAB</span></a>
        <nav aria-label="Main navigation"><a href="#overview">Overview</a><a href="#how-it-works">How it works</a><a href="#contact">Contact</a></nav>
        <Link className={styles.navLogin} href="/login">Log in <span aria-hidden="true">↗</span></Link>
      </header>
      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <LabScene />
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}><span className={styles.dot} /> A SPACE FOR IDEAS TO BECOME REAL</p>
            <h1 id="hero-title">ISANPOWER888<br /><em>LAB.</em></h1>
            <p className={styles.heroDescription}>Less coordination. More discovery.<br />Your people, requests, and lab work. In one shared space.</p>
            <Link className={styles.primaryButton} href="/login">Log in to your workspace <span aria-hidden="true">↗</span></Link>
            <p className={styles.heroNote}>FOR MEMBERS, TAs & LAB MANAGERS</p>
          </div>
          <div className={styles.heroBottom}><span>ISANPOWER888 / LAB WORKSPACE</span><a href="#overview">SCROLL TO EXPLORE <span aria-hidden="true">↓</span></a><span>IDEAS START HERE.</span></div>
        </section>
        <section className={styles.overview} id="overview" aria-labelledby="overview-title">
          <div className={styles.overviewScene} aria-hidden="true" />
          <Reveal>
            <div className={styles.sectionLabel}><span>01 / OVERVIEW</span><span>A SHARED PLACE TO MOVE FORWARD</span></div>
            <div className={styles.overviewIntro}><h2 id="overview-title">Good work starts<br />with <em>clear connections.</em></h2><p>From your first request to the final update, ISANPOWER888 LAB brings everyone onto the same page. A little less back-and-forth, and a little more room to focus on what matters.</p></div>
          </Reveal>
          <div className={styles.roles}>
            {[
              ["01", "Lab Members", "Start something.", "Submit what you need and follow your own requests in one place."],
              ["02", "Teaching Assistants", "Keep things moving.", "Coordinate requests, take on tasks, and share progress as work happens."],
              ["03", "Lab Managers", "See the bigger picture.", "Review requests that need approval and stay up to date with lab activity."],
            ].map(([number, role, title, text]) => <Reveal key={role}><article className={styles.role}><div className={styles.roleTop}><span>{number}</span><span aria-hidden="true">↗</span></div><p className={styles.eyebrow}>{role}</p><h3>{title}</h3><p>{text}</p></article></Reveal>)}
          </div>
        </section>
        <section className={styles.workflow} id="how-it-works" aria-labelledby="workflow-title">
          <Reveal><div className={styles.sectionLabel}><span>02 / HOW IT WORKS</span><span>FROM REQUEST TO DONE</span></div></Reveal>
          <div className={styles.workflowGrid}>
            <Reveal><h2 id="workflow-title">A simple flow.<br /><em>A clearer day.</em></h2><p className={styles.workflowIntro}>You bring the idea.<br />We help you keep the work organized.</p><Link className={styles.textLink} href="/login">Let’s get started <span aria-hidden="true">↗</span></Link></Reveal>
            <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title}><Reveal><div className={styles.step}><span className={styles.stepNumber}>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></div></Reveal></li>)}</ol>
          </div>
        </section>
        <section className={styles.contact} id="contact" aria-labelledby="contact-title">
          <Reveal><div className={styles.sectionLabel}><span>03 / CONTACT</span><span>LET’S STAY CONNECTED</span></div><div className={styles.contactHeading}><h2 id="contact-title">Questions?<br /><em>There’s room for those, too.</em></h2><span className={styles.contactStar} aria-hidden="true">✳</span></div><div className={styles.contactPlaceholder}><span>CONTACT DETAILS</span><span>Coming soon</span></div></Reveal>
        </section>
      </main>
      <footer className={styles.footer}><a className={styles.brand} href="#top">ISANPOWER888 / LAB</a><p className={styles.artCredit}>Original artwork by <a href="https://www.instagram.com/zenex.arts?g=5" target="_blank" rel="noopener noreferrer">@zenex.arts ↗</a><span>Adapted with AI for this website.</span></p><a href="#top">Back to top ↑</a></footer>
    </div>
  );
}
