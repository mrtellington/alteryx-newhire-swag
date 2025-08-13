import React from "react";

export default function SiteHeader() {
  return (
    <header className="w-full border-b border-border bg-background">
      <div className="container py-4 md:py-6">
        <a href="/shop" aria-label="Alteryx Swag Store home">
          <img
            src="/lovable-uploads/208e6bfa-df2a-49ae-8ec6-845390b8b855.png"
            alt="Alteryx Swag Store New Hire logo"
            className="h-10 md:h-12 w-auto"
            loading="eager"
          />
        </a>
      </div>
    </header>
  );
}
