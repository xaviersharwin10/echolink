import React from 'react';
interface ChartData {
    type: 'bar' | 'pie';
    title?: string;
    labels: string[];
    data: number[];
}

/**
 * Renders a simulated Bar Chart based on the LLM's structured JSON output.
 * * @param chartData Expected format: { type: 'bar' | 'pie', title: string, labels: string[], data: number[] }
 */
export const ChartRenderer = ({ chartData }: { chartData: ChartData }) => {
    if (!chartData || !Array.isArray(chartData.labels) || !Array.isArray(chartData.data) || chartData.labels.length === 0) {
        return <div className="text-red-500 text-sm">Error: Invalid chart data structure from AI.</div>;
    }

    const maxValue = Math.max(...chartData.data) || 1;
    const isBar = chartData.type === 'bar';
    const isPie = chartData.type === 'pie' && chartData.data.length > 0;

    return (
        <div className="p-4 bg-white rounded-lg shadow-inner">
            <h4 className="text-lg font-bold text-gray-800 mb-4">{chartData.title || "AI Generated Visualization"}</h4>

            {isBar && (
                <div className="space-y-4">
                    {chartData.labels.map((label, index) => {
                        const value = chartData.data[index] || 0;
                        const percentage = (value / maxValue) * 100;
                        const hue = (index * 60) % 360; // Distinct colors for each bar
                        const color = `hsl(${hue}, 70%, 50%)`;

                        return (
                            <div key={index}>
                                <div className="flex justify-between text-sm font-medium mb-1">
                                    <span className="truncate max-w-[60%]">{label}</span>
                                    <span className="font-semibold">{value.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-4">
                                    <div 
                                        className="h-4 rounded-full transition-all duration-700"
                                        style={{ width: `${percentage}%`, backgroundColor: color }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isPie && (
              <div className="flex flex-col items-center">
                <div className="relative w-48 h-48 rounded-full overflow-hidden">
                  {(() => {
                    const total = chartData.data.reduce((sum, val) => sum + val, 0);
                    let currentAngle = 0;
                    
                    return chartData.data.map((value, index) => {
                      const percentage = (value / total) * 100;
                      const angle = (value / total) * 360;
                      const hue = (index * 60) % 360;
                      const color = `hsl(${hue}, 70%, 50%)`;
                      
                      const slice = (
                        <div
                          key={index}
                          className="absolute w-full h-full"
                          style={{
                            background: `conic-gradient(from ${currentAngle}deg, ${color} 0deg, ${color} ${angle}deg, transparent ${angle}deg)`,
                          }}
                        />
                      );
                      
                      currentAngle += angle;
                      return slice;
                    });
                  })()}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {chartData.labels.map((label, index) => {
                    const value = chartData.data[index] || 0;
                    const total = chartData.data.reduce((sum, val) => sum + val, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    const hue = (index * 60) % 360;
                    const color = `hsl(${hue}, 70%, 50%)`;
                    
                    return (
                      <div key={index} className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate text-xs">
                          {label}: {percentage}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {!isBar && !isPie && (
                <p className="text-gray-500">Unsupported chart type: {chartData.type}</p>
            )}
        </div>
    );
};