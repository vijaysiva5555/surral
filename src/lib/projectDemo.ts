/* Demo content for a new project quotation – the company's own Promix 2KS offer (two systems, primer and topcoat).
   "Load demo content" in the editor fills the form with it; the photos are uploaded to S3 like any other image
   from the files in public/demo/project. The customer is left for the user to choose. */
import { DEFAULT_EXCLUSIONS, DEFAULT_PROJECT_TERMS, defaultIntro } from "./projectQuote";

const spec = (rows: [string, string][]) => rows.map(([label, value]) => ({ label, value }));
const consist = (rows: [string, string][]) => rows.map(([description, qty]) => ({ description, qty }));

const GRACO_SUPPLY = consist([
  ["Promix 2KS Automatic System with G3000 Meter & Discrete I/O Communication Kit for 1C, 1H & 1S", "1 No"],
  ["Merkur 48:1 Ratio, 75cc Piston Pump for Paint", "1 No"],
  ["Merkur Bellow 35:1 Ratio, 100cc Piston Pump for Hardener", "1 No"],
  ["Merkur 30:1 Ratio, 75cc Piston Pump for Solvent", "1 No"],
  ["High Pressure SS Fluid Filter with Drain Ball Valve", "3 Nos"],
  ["High Pressure Fluid Pressure Regulator with Gauge, Air Operated", "1 No"],
  ["PerformAA Auto Air Assist Spray Gun with General Finishing (GF) Air Cap & Manifold with bottom fluid ports", "1 No"],
]);
const SURRAL_SUPPLY = consist([
  ["Surral Make SS 304 25ltr Air Tight Tank for Hardener with Level Tube", "1 No"],
  ["Surral Make SS 304 25ltr Tank for Solvent", "1 No"],
  ["Surral Make MS PU Painted Mounting Frame with Bracket for Pump & Tank", "3 Nos"],
  ["Surral Make MS PU Painted Mounting Frame for Promix 2KS", "1 No"],
  ["Suction Hose with Y-Strainer Ball Valve Setup", "3 Nos"],
  ["Air Control Bracket for Pump, Gun & Agitator (Air Regulator, Pressure Gauge)", "5 Nos"],
  ["Air Control Bracket for 2KS (Air Regulator, Pressure Gauge)", "1 No"],
  ["Delivery Hose with End Fittings & Delivery Ball Valve", "1 Lot"],
  ["Fittings and Accessories", "1 Set"],
]);

const SUBJECT = "Quotation for Promix 2KS Automatic System";

export const PROJECT_DEMO = {
  subject: SUBJECT,
  intro: defaultIntro("Promix 2KS system"),
  systemName: "Promix 2KS Automatic System",
  coverPhoto: "/demo/project/cover.jpg",
  approvedBy: "B. Mushtaq Ali",
  equipmentGraco: ["ProMix 2KS 1C, 1H & 1S", "Merkur Pump 48:1, 75cc", "Merkur Bellows 35:1 100cc", "Merkur Pump 30:1, 75cc"],
  equipmentSurral: ["SS Tanks", "MS Mounting Frame", "Accessories"],
  technicals: [
    { title: "ProMix 2KS Automatic Wall Panel System", photo: "/demo/project/promix-2ks.jpg", specs: spec([
      ["Model - Series", "ProMix - 2KS"], ["Type", "Automatic Electronic Two Component Proportioning System"], ["Power Source", "Electric"],
      ["Measuring Meter Type", "G3000 - Meter"], ["Air Inlet Size (in)", "3/8 Female NPT"], ["Frequency (Hz)", "50/60"], ["Amperage (A)", "2"],
      ["Applicator Type & Gun Activation", "Automatic"], ["Fluid Inlet Size (in)", "1/4 Female NPT"], ["Fluid Outlet Size (in)", "1/4 Female NPT"],
      ["Flush Type", "Air / Solvent"], ["Maximum Flow Rate (GPM)", "1"], ["Maximum Fluid Viscosity (CP)", "3000"], ["Maximum Working Pressure (psi)", "4000"],
      ["Maximum Mix Ratio", "50:1"], ["Maximum Number of Colors", "Up to 30"], ["Number of Catalysts Valves", "As per Quote"], ["Number of Color Valves", "As per Quote"],
      ["Sound Power Level (dB(A))", "85"], ["Wetted Material", "Perfluoroelastomer, PTFE, Stainless Steel, Tungsten Carbide"],
    ]) },
    { title: "Merkur 48:1 Ratio Pump", photo: "/demo/project/merkur-48.jpg", specs: spec([
      ["Pump Type", "Pneumatic Piston Pump"], ["Model - Series", "Merkur Standard"], ["Motor Type", "Pneumatic"], ["Pump Pressure Ratio", "48:1"],
      ["Pump Flow Rate", "75cc / Cycle"], ["Air Inlet Size (in)", "1/2"], ["Fluid Inlet Size (in)", "3/4 NPT"], ["Fluid Outlet Size (in)", "3/8 NPT"],
      ["Maximum Air Inlet Pressure", "100 (psi)"], ["Maximum Flow Rate (GPM)", "1.2"], ["Maximum Working Pressure", "4800 (psi)"],
      ["Wetted Material", "Stainless Steel, Tungsten Carbide with 6% Nickel, UHMWPE, PTFE, Nylon"],
    ]) },
    { title: "Fluid Filter", photo: "/demo/project/fluid-filter.jpg", specs: spec([
      ["Type", "Filter"], ["Material Housing", "SS"], ["Outlet Size (in)", "1/4 NPT"], ["Inlet Size (in)", "3/8 NPT"],
      ["Maximum Working Pressure (psi)", "5000"], ["Wetted Material", "PTFE, Polyethylene, Passivated Stainless Steel"],
    ]) },
    { title: "Merkur 35:1 Ratio Bellows Pump", photo: "/demo/project/merkur-bellows-35.jpg", specs: spec([
      ["Type", "Pneumatic Piston Pump"], ["Model - Series", "Merkur - Bellow"], ["Application", "Supply Pump"], ["Motor Type", "NXT - Pneumatic"],
      ["Compatible Material", "Waterborne, Solvent borne, High Solids, Xirallic, CARC, Metallics, Topcoats, Stains, Varnish, UV Coating"],
      ["Fluid Inlet Size (in)", "3/4 NPT"], ["Fluid Outlet Size (in)", "3/8 NPT"], ["Material – Pump Lower", "Stainless Steel"],
      ["Maximum Flow Rate (gpm @ 60 cpm)", "1.6"], ["Maximum Working Pressure (psi)", "3500"], ["Pump Ratio", "35:1"], ["Pump Flow Rate", "100cc / Per cycle"],
      ["Wetted Material", "Stainless Steel"],
    ]) },
    { title: "High Fluid Pressure Regulator", photo: "/demo/project/fluid-regulator.jpg", specs: spec([
      ["Type", "Fluid Regulator"], ["Actuation Type", "Air Operated"], ["Gauge Port Size (in)", "1/4” NPT"], ["Inlet & Outlet Size (in)", "3/8 NPT"],
      ["Maximum Flow Rate (GPM)", "1"], ["Maximum Regulated Pressure (psi)", "4000"], ["Maximum Working Pressure (psi)", "6000"],
      ["Minimum Regulated Pressure (psi)", "500"], ["Wetted Material", "Stainless Steel"],
    ]) },
    { title: "Automatic Air Assist Spray Gun", photo: "/demo/project/air-assist-gun.jpg", specs: spec([
      ["Type", "Auto Air Assist Spray Gun"], ["Model", "Air Assist"], ["Applicator Type", "Automatic"], ["Maximum Air Inlet Pressure (psi)", "100"],
      ["Fluid Inlet Size", "1/4”"], ["Maximum Working Fluid Pressure (psi)", "4000"], ["Air Inlet Size", "1/4 Male NPSM"],
    ]) },
  ],
  offers: [
    { title: "1. Offer for Graco Promix 2KS System 1C, 1H & 1S - Primer", items: [{ description: "Promix 2KS System for Primer", qty: "1 Set", unitPrice: 6092000 }], consists: GRACO_SUPPLY, surralConsists: SURRAL_SUPPLY, images: [] as string[] },
    { title: "2. Offer for Graco Promix 2KS System 1C, 1H & 1S - Topcoat", items: [{ description: "Promix 2KS System for Topcoat", qty: "1 Set", unitPrice: 6092000 }], consists: GRACO_SUPPLY, surralConsists: SURRAL_SUPPLY, images: [] as string[] },
  ],
  extras: [{ description: "Installation", qty: "1 Set", unitPrice: 100000 }, { description: "Freight", qty: "1 Set", unitPrice: 25000 }],
  exclusions: DEFAULT_EXCLUSIONS,
  terms: DEFAULT_PROJECT_TERMS(),
};
