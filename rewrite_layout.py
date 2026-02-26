import re

with open("public/index.html", "r") as f:
    html = f.read()

# I will find the Main Body Container which starts around line 292
start_marker = '<div class="grid grid-cols-1 lg:grid-cols-4 gap-6 relative">'
start_idx = html.find(start_marker) + len(start_marker)
# Find the Modals start
end_marker = '<!-- Modals -->'
end_idx = html.find(end_marker)

# We want to replace everything between start_idx and end_idx (minus that </div> closing the grid)
# Wait, let's just do a manual string block replacement. Let's extract the shift-editor and dashboard.

# Extract dashboard
dash_start = html.find('<div id="dashboard"')
dash_end = html.find('</div>\n\n                <div id="shift-editor"', dash_start) + 6

dash_html = html[dash_start:dash_end]
dash_html = dash_html.replace('mb-8', '') # remove mb-8

# Extract Shift-Editor
shift_start = html.find('<div id="shift-editor"')
shift_end = html.find('</div>\n            </div>\n\n            <div id="toast"', shift_start) + 6

shift_html = html[shift_start:shift_end]
shift_html = shift_html.replace('mb-8', '') # remove mb-8 from shift editor
# Also update Shift Editor per user request
# - Remove duplicate store selector
store_selector_block = re.search(r'<label for="editorStoreSelector".*?</select>', shift_html, re.DOTALL)
if store_selector_block:
    shift_html = shift_html.replace(store_selector_block.group(0), '')
# - Empty state text update: I'll add an empty state div into weekly-editor-container inside JS later, or add it here text.

# Add clear period warning styling in shift_html
shift_html = shift_html.replace('bg-gray-700 hover:bg-gray-600', 'bg-red-900 hover:bg-red-800 border border-red-700')
shift_html = shift_html.replace('text-red-400', 'text-white')

# Build new Left Column
left_col = f"""
            <!-- LEFT COLUMN (Main Focus) -->
            <div class="lg:col-span-3 flex flex-col gap-6 w-full">
                {shift_html}

                <!-- Schedule Container Component -->
                <div class="flex flex-col gap-2 relative mt-4">
                    <div class="flex justify-between items-end px-2 md:px-0 w-full">
                        <h3 class="text-xl font-bold text-gray-300 hidden sm:block">The Schedule Grid</h3>
                        <div class="view-controls flex gap-2 rounded-lg bg-gray-900 shadow-md p-1 w-full sm:w-auto min-w-[200px]">
                            <button data-view="week" class="view-btn flex-1 text-sm py-1.5 px-4 rounded-md transition text-gray-300 hover:bg-gray-800" data-translate="weekView">Week</button>
                            <button data-view="fortnight" class="view-btn flex-1 text-sm py-1.5 px-4 rounded-md transition active bg-orange-500 text-white font-bold" data-translate="fortnightView">14 Days</button>
                        </div>
                    </div>
                    <div id="schedule-container" class="overflow-x-auto bg-white p-2 md:p-4 rounded-xl shadow-md relative z-0"></div>
                </div>
            </div>
"""

right_col = f"""
            <!-- RIGHT COLUMN (Side Panel) -->
            <div class="lg:col-span-1 flex flex-col gap-6 w-full">
                <!-- Summary Card -->
                <div id="dashboard-card" class="admin-only hidden">
                    {dash_html}
                </div>

                <!-- Export & Share Card -->
                <div class="bg-gray-900 p-5 rounded-2xl shadow-lg flex flex-col gap-3">
                    <h3 class="text-white font-bold text-lg flex items-center gap-2"><i data-lucide="share-2" class="w-5 h-5 text-gray-400"></i> Export & Share</h3>
                    <button id="mainExportBtn" class="bg-white hover:bg-gray-200 text-black font-bold py-2.5 px-4 rounded-lg transition duration-300 flex items-center justify-center gap-2 w-full">
                        <i data-lucide="external-link" class="w-5 h-5"></i> Export Roster
                    </button>
                </div>

                <!-- Support Card -->
                <div class="bg-gray-900 p-5 rounded-2xl shadow-lg flex flex-col gap-3">
                    <h3 class="text-orange-400 font-bold flex items-center gap-2"><i data-lucide="heart" class="w-5 h-5"></i> Support</h3>
                    <p class="text-gray-400 text-xs text-center mb-1">Your support helps cover hosting and improvements.</p>
                    <button id="supportDonateBtn" class="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition duration-300 w-full"><i data-lucide="coffee" class="w-4 h-4"></i> Donate</button>
                    <button id="supportMonthlyBtn" class="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition duration-300 w-full"><i data-lucide="shield-check" class="w-4 h-4"></i> Support Monthly</button>
                </div>

                <!-- Admin Tools Card -->
                <div id="admin-tools-card" class="bg-gray-900 p-5 rounded-2xl shadow-lg flex-col gap-3 hidden admin-only">
                    <h3 class="text-white font-bold text-lg mb-2 flex items-center gap-2"><i data-lucide="shield" class="w-5 h-5 text-gray-400"></i> Admin Tools</h3>
                    <button id="openEngineRulesBtn" class="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center gap-3 transition w-full text-sm">
                        <i data-lucide="settings-2" class="w-4 h-4 text-orange-400"></i> Engine Rules
                    </button>
                    <button id="openStoresBtn" class="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center gap-3 transition w-full text-sm">
                        <i data-lucide="store" class="w-4 h-4 text-orange-400"></i> Manage Stores
                    </button>
                    <button id="openMembersBtn" class="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center gap-3 transition w-full text-sm">
                        <i data-lucide="users" class="w-4 h-4 text-orange-400"></i> Manage Members
                    </button>
                </div>
            </div>
"""

# Now write back the whole chunk
new_block = left_col + right_col + """
        </div>

        <div id="toast"
            class="fixed top-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg opacity-0 invisible transition-all duration-300 z-50">
            <p id="toast-message"></p>
        </div>
    </div>
"""

new_html = html[:start_idx] + new_block + "\n    " + html[end_idx:]

with open("public/index.html", "w") as f:
    f.write(new_html)

print("Layout replaced successfully.")
