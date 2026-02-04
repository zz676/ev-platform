import { getTranslations } from "next-intl/server";

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");

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
          {/* Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.informationCollect.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.informationCollect.content")}</p>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.howWeUse.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.howWeUse.content")}</p>
          </section>

          {/* Information Sharing */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.informationSharing.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.informationSharing.content")}</p>
          </section>

          {/* Cookies and Tracking */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.cookies.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.cookies.content")}</p>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.dataSecurity.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.dataSecurity.content")}</p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.yourRights.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.yourRights.content")}</p>
          </section>

          {/* Changes to Policy */}
          <section>
            <h2 className="text-xl font-semibold text-ev-green-900 mb-3">
              {t("sections.changesToPolicy.title")}
            </h2>
            <p className="leading-relaxed">{t("sections.changesToPolicy.content")}</p>
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
