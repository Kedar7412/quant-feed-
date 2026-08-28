import { Brain } from "lucide-react";
import { PathwaySimulator } from "@/components/PathwaySimulator";
import { mockPathways, mockArticles, mockDailySummary } from "@/lib/mock-data";

export default function AnalysisPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="h-6 w-6 text-indigo-400" />
          AI Analysis
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Economic pathway predictions from micro to macro with interactive simulation
        </p>
      </div>

      {/* Daily Analysis Card */}
      <div className="bg-gray-800/20 border border-gray-700/50 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-3">
          Today&apos;s AI Analysis
        </h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          {mockDailySummary.headline}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/40 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-indigo-400 mb-2">
              Micro-level Signals
            </h3>
            <ul className="space-y-1.5 text-xs text-gray-400">
              <li>- UPI transaction volumes indicate strong consumer activity</li>
              <li>- EV sales growth signals auto sector transformation</li>
              <li>- Food inflation eroding rural purchasing power</li>
              <li>- IT hiring rebound confirms tech sector recovery</li>
            </ul>
          </div>
          <div className="bg-gray-800/40 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-amber-400 mb-2">
              Macro-level Outlook
            </h3>
            <ul className="space-y-1.5 text-xs text-gray-400">
              <li>- Global rate easing cycle supports Indian asset prices</li>
              <li>- China+1 strategy accelerating India manufacturing shift</li>
              <li>- Infrastructure investments creating multi-year growth runway</li>
              <li>- Current account deficit manageable with strong FII flows</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Pathway Simulator */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Pathway Simulator
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Select different news inputs to simulate how economic pathways might change. Toggle events
          on/off to explore alternative scenarios.
        </p>
        <PathwaySimulator pathways={mockPathways} articles={mockArticles} />
      </div>
    </div>
  );
}
