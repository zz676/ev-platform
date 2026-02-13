"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function PricingPage() {
    const [mounted, setMounted] = useState(false);
    const [isAnnual, setIsAnnual] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="bg-background-light dark:bg-background-dark text-gray-800 dark:text-gray-100 font-display min-h-screen">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                                <span className="material-icons text-background-dark text-xl">
                                    bolt
                                </span>
                            </div>
                            <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">
                                Juice Index
                            </span>
                        </Link>
                        <div className="hidden md:flex items-center space-x-8">
                            <Link
                                href="#"
                                className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors text-sm font-medium"
                            >
                                Market Data
                            </Link>
                            <Link
                                href="#"
                                className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors text-sm font-medium"
                            >
                                Insights
                            </Link>
                            <Link
                                href="#"
                                className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors text-sm font-medium"
                            >
                                Enterprise
                            </Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link
                                href="/login"
                                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary"
                            >
                                Log in
                            </Link>
                            <Link
                                href="/signup"
                                className="bg-gray-900 dark:bg-white text-white dark:text-background-dark hover:bg-primary hover:text-background-dark dark:hover:bg-primary px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative pt-16 pb-12 sm:pt-24 sm:pb-16 px-4">
                <div className="relative max-w-7xl mx-auto text-center z-10">
                    <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
                        Intelligence on the{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-600">
                            Chinese EV Market
                        </span>
                    </h1>
                    <p className="mt-4 text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        Real-time data on production, batteries, and supply chains. Make
                        smarter investment decisions with Juice Index.
                    </p>
                    {/* Toggle */}
                    <div className="mt-12 flex justify-center items-center space-x-4">
                        <span className="text-base font-medium text-gray-500 dark:text-gray-400">
                            Monthly
                        </span>
                        <button
                            onClick={() => setIsAnnual(!isAnnual)}
                            aria-checked={isAnnual}
                            className={`${isAnnual ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"
                                } relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
                            role="switch"
                            type="button"
                        >
                            <span
                                aria-hidden="true"
                                className={`${isAnnual ? "translate-x-6" : "translate-x-0"
                                    } pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            ></span>
                        </button>
                        <span className="text-base font-medium text-gray-900 dark:text-white">
                            Yearly
                        </span>
                        <span className="inline-flex items-center rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary dark:text-primary">
                            Save 20%
                        </span>
                    </div>
                </div>
            </div>

            {/* Pricing Cards Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    {/* Analyst Tier */}
                    <div className="bento-card bg-surface-light dark:bg-surface-dark rounded-lg p-8 h-full flex flex-col border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-shadow duration-300">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                Analyst
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                Essential market tracking for casual observers.
                            </p>
                        </div>
                        <div className="my-6">
                            <p className="flex items-baseline">
                                <span className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                                    $0
                                </span>
                                <span className="ml-1 text-xl font-semibold text-gray-500">
                                    /mo
                                </span>
                            </p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1" role="list">
                            <li className="flex items-start">
                                <span className="material-icons text-gray-400 text-sm mt-1 mr-3">
                                    check_circle
                                </span>
                                <span className="text-gray-600 dark:text-gray-300 text-sm">
                                    Weekly Market Newsletter
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="material-icons text-gray-400 text-sm mt-1 mr-3">
                                    check_circle
                                </span>
                                <span className="text-gray-600 dark:text-gray-300 text-sm">
                                    Top-level Production Stats
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="material-icons text-gray-400 text-sm mt-1 mr-3">
                                    check_circle
                                </span>
                                <span className="text-gray-600 dark:text-gray-300 text-sm">
                                    Public Forum Access
                                </span>
                            </li>
                        </ul>
                        <Link
                            href="/signup"
                            className="block w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-center rounded-full py-3 text-sm font-semibold transition-colors"
                        >
                            Start Free
                        </Link>
                    </div>

                    {/* Pro Tier (Highlighted) */}
                    <div className="relative transform md:-translate-y-4">
                        <div className="absolute -top-4 left-0 right-0 flex justify-center">
                            <span className="inline-flex items-center rounded-full bg-primary px-4 py-1 text-xs font-bold text-background-dark uppercase tracking-wide shadow-lg">
                                Recommended
                            </span>
                        </div>
                        <div className="bento-card bg-surface-light dark:bg-surface-dark rounded-lg p-8 h-full flex flex-col border-2 border-primary shadow-xl shadow-primary/10 hover:shadow-primary/20 transition-shadow duration-300">
                            <div className="mb-4 pt-2">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Pro
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                    Deep dives for investors and researchers.
                                </p>
                            </div>
                            <div className="my-6">
                                <p className="flex items-baseline">
                                    <span className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                                        ${isAnnual ? "24" : "29"}
                                    </span>
                                    <span className="ml-1 text-xl font-semibold text-gray-500">
                                        /mo
                                    </span>
                                </p>
                                <p className="text-xs text-primary font-medium mt-1">
                                    Billed {isAnnual ? "annually ($288)" : "monthly"}
                                </p>
                            </div>
                            <ul className="space-y-4 mb-8 flex-1" role="list">
                                <li className="flex items-start">
                                    <span className="material-icons text-primary text-sm mt-1 mr-3">
                                        check_circle
                                    </span>
                                    <span className="text-gray-900 dark:text-white font-medium text-sm">
                                        Full Dashboard Access
                                    </span>
                                </li>
                                <li className="flex items-start">
                                    <span className="material-icons text-primary text-sm mt-1 mr-3">
                                        check_circle
                                    </span>
                                    <span className="text-gray-600 dark:text-gray-300 text-sm">
                                        Unlimited CSV Exports
                                    </span>
                                </li>
                                <li className="flex items-start">
                                    <span className="material-icons text-primary text-sm mt-1 mr-3">
                                        check_circle
                                    </span>
                                    <span className="text-gray-600 dark:text-gray-300 text-sm">
                                        5-Year Historical Data
                                    </span>
                                </li>
                                <li className="flex items-start">
                                    <span className="material-icons text-primary text-sm mt-1 mr-3">
                                        check_circle
                                    </span>
                                    <span className="text-gray-600 dark:text-gray-300 text-sm">
                                        Advanced Filter sets
                                    </span>
                                </li>
                            </ul>
                            <Link
                                href="/signup?plan=pro"
                                className="block w-full bg-primary hover:bg-primary/90 text-background-dark text-center rounded-full py-4 text-sm font-bold shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40"
                            >
                                Get Started with Pro
                            </Link>
                        </div>
                    </div>

                    {/* Institutional Tier */}
                    <div className="bento-card bg-surface-light dark:bg-surface-dark rounded-lg p-8 h-full flex flex-col border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-shadow duration-300">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                Institutional
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                Full scale intelligence for enterprise teams.
                            </p>
                        </div>
                        <div className="my-6">
                            <p className="flex items-baseline">
                                <span className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                                    Custom
                                </span>
                            </p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1" role="list">
                            <li className="flex items-start">
                                <span className="material-icons text-gray-400 text-sm mt-1 mr-3">
                                    check_circle
                                </span>
                                <span className="text-gray-600 dark:text-gray-300 text-sm">
                                    Full API Access
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="material-icons text-gray-400 text-sm mt-1 mr-3">
                                    check_circle
                                </span>
                                <span className="text-gray-600 dark:text-gray-300 text-sm">
                                    Multi-seat Licenses
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="material-icons text-gray-400 text-sm mt-1 mr-3">
                                    check_circle
                                </span>
                                <span className="text-gray-600 dark:text-gray-300 text-sm">
                                    Dedicated Analyst Support
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="material-icons text-gray-400 text-sm mt-1 mr-3">
                                    check_circle
                                </span>
                                <span className="text-gray-600 dark:text-gray-300 text-sm">
                                    Custom Report Generation
                                </span>
                            </li>
                        </ul>
                        <Link
                            href="/contact"
                            className="block w-full bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-background-dark text-center rounded-full py-3 text-sm font-semibold transition-colors"
                        >
                            Contact Sales
                        </Link>
                    </div>
                </div>
            </div>

            {/* Feature Comparison Table */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
                <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="p-8 pb-4 border-b border-gray-200 dark:border-gray-800">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Feature Comparison
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr>
                                    <th className="p-6 bg-surface-light dark:bg-surface-dark sticky left-0 z-10 w-1/3 min-w-[200px]"></th>
                                    <th className="p-6 text-center text-lg font-semibold text-gray-900 dark:text-white min-w-[150px]">
                                        Analyst
                                    </th>
                                    <th className="p-6 text-center text-lg font-semibold text-primary min-w-[150px]">
                                        Pro
                                    </th>
                                    <th className="p-6 text-center text-lg font-semibold text-gray-900 dark:text-white min-w-[150px]">
                                        Institutional
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {/* Category: Market Coverage */}
                                <tr className="bg-gray-50/50 dark:bg-white/5">
                                    <td
                                        className="p-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider"
                                        colSpan={4}
                                    >
                                        Market Coverage
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-4 px-6 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-surface-light dark:bg-surface-dark">
                                        OEM Production Numbers
                                    </td>
                                    <td className="p-4 text-center text-sm text-gray-500">
                                        Top 10 Only
                                    </td>
                                    <td className="p-4 text-center text-primary">
                                        <span className="material-icons text-sm">check_circle</span>
                                    </td>
                                    <td className="p-4 text-center text-primary">
                                        <span className="material-icons text-sm">check_circle</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-4 px-6 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-surface-light dark:bg-surface-dark">
                                        Startup EV Makers
                                    </td>
                                    <td className="p-4 text-center text-gray-400">
                                        <span className="material-icons text-sm">remove</span>
                                    </td>
                                    <td className="p-4 text-center text-primary">
                                        <span className="material-icons text-sm">check_circle</span>
                                    </td>
                                    <td className="p-4 text-center text-primary">
                                        <span className="material-icons text-sm">check_circle</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-4 px-6 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-surface-light dark:bg-surface-dark">
                                        Battery Supply Chain
                                    </td>
                                    <td className="p-4 text-center text-gray-400">
                                        <span className="material-icons text-sm">remove</span>
                                    </td>
                                    <td className="p-4 text-center text-sm text-gray-900 dark:text-white">
                                        Top Tier Only
                                    </td>
                                    <td className="p-4 text-center text-primary">
                                        <span className="material-icons text-sm">check_circle</span>
                                    </td>
                                </tr>
                                {/* Category: Data Granularity */}
                                <tr className="bg-gray-50/50 dark:bg-white/5">
                                    <td
                                        className="p-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider"
                                        colSpan={4}
                                    >
                                        Data Granularity
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-4 px-6 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-surface-light dark:bg-surface-dark">
                                        Update Frequency
                                    </td>
                                    <td className="p-4 text-center text-sm text-gray-500">
                                        Monthly
                                    </td>
                                    <td className="p-4 text-center text-sm text-gray-900 dark:text-white">
                                        Weekly
                                    </td>
                                    <td className="p-4 text-center text-sm text-gray-900 dark:text-white">
                                        Daily / Real-time
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-4 px-6 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-surface-light dark:bg-surface-dark">
                                        Historical Data
                                    </td>
                                    <td className="p-4 text-center text-sm text-gray-500">
                                        1 Year
                                    </td>
                                    <td className="p-4 text-center text-sm text-gray-900 dark:text-white">
                                        5 Years
                                    </td>
                                    <td className="p-4 text-center text-sm text-gray-900 dark:text-white">
                                        Unlimited
                                    </td>
                                </tr>
                                {/* Category: Export Capabilities */}
                                <tr className="bg-gray-50/50 dark:bg-white/5">
                                    <td
                                        className="p-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider"
                                        colSpan={4}
                                    >
                                        Export & Access
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-4 px-6 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-surface-light dark:bg-surface-dark">
                                        CSV Export
                                    </td>
                                    <td className="p-4 text-center text-gray-400">
                                        <span className="material-icons text-sm">remove</span>
                                    </td>
                                    <td className="p-4 text-center text-primary">
                                        <span className="material-icons text-sm">check_circle</span>
                                    </td>
                                    <td className="p-4 text-center text-primary">
                                        <span className="material-icons text-sm">check_circle</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-4 px-6 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-surface-light dark:bg-surface-dark">
                                        API Access
                                    </td>
                                    <td className="p-4 text-center text-gray-400">
                                        <span className="material-icons text-sm">remove</span>
                                    </td>
                                    <td className="p-4 text-center text-gray-400">
                                        <span className="material-icons text-sm">remove</span>
                                    </td>
                                    <td className="p-4 text-center text-primary">
                                        <span className="material-icons text-sm">check_circle</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-12">
                    Frequently Asked Questions
                </h2>
                <div className="space-y-4">
                    {/* FAQ Item 1 */}
                    <details className="group bg-surface-light dark:bg-surface-dark rounded-lg p-6 [&_summary::-webkit-details-marker]:hidden border border-gray-100 dark:border-gray-800">
                        <summary className="flex items-center justify-between cursor-pointer text-gray-900 dark:text-white font-medium">
                            <span>What payment methods do you accept?</span>
                            <span className="transition group-open:rotate-180">
                                <span className="material-icons">expand_more</span>
                            </span>
                        </summary>
                        <p className="mt-4 leading-relaxed text-gray-500 dark:text-gray-400 text-sm">
                            We accept all major credit cards (Visa, Mastercard, Amex) for Pro
                            plans. For Institutional plans, we can also support wire transfers
                            and purchase orders.
                        </p>
                    </details>
                    {/* FAQ Item 2 */}
                    <details className="group bg-surface-light dark:bg-surface-dark rounded-lg p-6 [&_summary::-webkit-details-marker]:hidden border border-gray-100 dark:border-gray-800">
                        <summary className="flex items-center justify-between cursor-pointer text-gray-900 dark:text-white font-medium">
                            <span>Can I cancel my subscription anytime?</span>
                            <span className="transition group-open:rotate-180">
                                <span className="material-icons">expand_more</span>
                            </span>
                        </summary>
                        <p className="mt-4 leading-relaxed text-gray-500 dark:text-gray-400 text-sm">
                            Yes, you can cancel your subscription at any time. Your access
                            will remain active until the end of your current billing period.
                        </p>
                    </details>
                    {/* FAQ Item 3 */}
                    <details className="group bg-surface-light dark:bg-surface-dark rounded-lg p-6 [&_summary::-webkit-details-marker]:hidden border border-gray-100 dark:border-gray-800">
                        <summary className="flex items-center justify-between cursor-pointer text-gray-900 dark:text-white font-medium">
                            <span>Do you offer academic discounts?</span>
                            <span className="transition group-open:rotate-180">
                                <span className="material-icons">expand_more</span>
                            </span>
                        </summary>
                        <p className="mt-4 leading-relaxed text-gray-500 dark:text-gray-400 text-sm">
                            Yes! We offer special pricing for students and university
                            researchers. Please contact us with your .edu email address for
                            more information.
                        </p>
                    </details>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="md:flex md:justify-between">
                        <div className="mb-8 md:mb-0">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                                    <span className="material-icons text-background-dark text-sm">
                                        bolt
                                    </span>
                                </div>
                                <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">
                                    Juice Index
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                                The leading data intelligence platform for the Chinese electric
                                vehicle market.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                                    Product
                                </h3>
                                <ul className="mt-4 space-y-2">
                                    <li>
                                        <Link
                                            href="#features"
                                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary"
                                        >
                                            Features
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/pricing"
                                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary"
                                        >
                                            Pricing
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/api"
                                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary"
                                        >
                                            API
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                                    Company
                                </h3>
                                <ul className="mt-4 space-y-2">
                                    <li>
                                        <Link
                                            href="/about"
                                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary"
                                        >
                                            About
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/blog"
                                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary"
                                        >
                                            Blog
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/careers"
                                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary"
                                        >
                                            Careers
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="mt-12 border-t border-gray-100 dark:border-gray-800 pt-8 flex justify-between items-center">
                        <p className="text-xs text-gray-400">
                            © 2024 Juice Index. All rights reserved.
                        </p>
                        <div className="flex space-x-4">
                            <Link href="#" className="text-gray-400 hover:text-gray-500">
                                <span className="sr-only">Twitter</span>
                                <span className="material-icons text-xl">public</span>
                            </Link>
                            <Link href="#" className="text-gray-400 hover:text-gray-500">
                                <span className="sr-only">GitHub</span>
                                <span className="material-icons text-xl">code</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Background Pattern */}
            <div
                className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 opacity-30 dark:opacity-10"
                style={{
                    backgroundImage:
                        "radial-gradient(#6ada1b 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                }}
            ></div>
        </div>
    );
}
