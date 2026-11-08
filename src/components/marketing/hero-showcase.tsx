const HERO_IMG =
  "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/1-1024x1015.webp";

const SHAPES = [
  {
    src: "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/2.webp",
    className: "site-shape site-shape-a",
  },
  {
    src: "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/3.webp",
    className: "site-shape site-shape-b",
  },
  {
    src: "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/4.webp",
    className: "site-shape site-shape-c",
  },
  {
    src: "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/5.webp",
    className: "site-shape site-shape-d",
  },
];

export function HeroShowcase() {
  return (
    <div className="site-hero-stage site-anim-fade site-anim-fade-delay-2 relative mx-auto w-full max-w-xl">
      <div className="site-hero-mesh" aria-hidden />
      <div className="site-hero-rings" aria-hidden />
      <div className="site-hero-dots" aria-hidden />

      {SHAPES.map((shape) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={shape.src}
          src={shape.src}
          alt=""
          className={shape.className}
          aria-hidden
        />
      ))}

      <div className="site-hero-slider relative z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMG}
          alt="CRM product preview"
          className="site-anim-float relative mx-auto w-full object-contain"
        />
      </div>
    </div>
  );
}
