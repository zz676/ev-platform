import { getTranslations } from "next-intl/server";

export default async function TermsPage() {
  const t = await getTranslations("Terms");

  return (
    <div className="min-h-screen bg-ev-green-950 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white border border-ev-green-200 rounded-lg p-8">
        <h1 className="text-3xl font-bold text-ev-green-900 text-center mb-2">
          {t("title")}
        </h1>
        <p className="text-sm text-ev-green-600 text-center mb-8">
          {t("lastUpdated")}
        </p>

        <div className="space-y-8 text-ev-green-800">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.introduction.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.introduction.content")}</p>
          </section>

          {/* Use of Service */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.useOfService.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.useOfService.content")}</p>
          </section>

          {/* User Content */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.userContent.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.userContent.content")}</p>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.intellectualProperty.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.intellectualProperty.content")}</p>
          </section>

          {/* Disclaimers */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.disclaimers.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.disclaimers.content")}</p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.limitationOfLiability.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.limitationOfLiability.content")}</p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.changesToTerms.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.changesToTerms.content")}</p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.contact.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.contact.content")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
