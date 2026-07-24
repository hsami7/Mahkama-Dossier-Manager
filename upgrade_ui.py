import os

with open('static/js/main.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

target_block = """                const groupLim = document.createElement('div');
                groupLim.className = 'input-group';
                groupLim.innerHTML = `
                    <label for="limit_${code}">الفئة ${code} (الأقصى):</label>
                    <input type="number" id="limit_${code}" data-code="${code}" data-type="limit" value="${codeSet.limit}" min="1" required style="width:100%; padding:8px; border:1px solid #dfe7ef; border-radius:4px;">
                `;
                formLimits.appendChild(groupLim);

                const groupThresh = document.createElement('div');
                groupThresh.className = 'input-group';
                groupThresh.style.border = '1px solid #e2e8f0';
                groupThresh.style.padding = '10px';
                groupThresh.style.borderRadius = '6px';
                groupThresh.style.background = 'white';
                groupThresh.innerHTML = `
                    <div style="font-weight:bold; margin-bottom:8px;">الفئة ${code}</div>
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; color:#dc3545;">أحمر (أيام):</label>
                            <input type="number" data-code="${code}" data-type="red" value="${codeSet.red}" min="1" required style="width:100%; padding:6px; border:1px solid #dfe7ef; border-radius:4px;">
                        </div>
                    </div>
                `;
                formThresholds.appendChild(groupThresh);"""

replacement_block = """                const groupLim = document.createElement('div');
                groupLim.style.cssText = 'background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 8px; transition: all 0.2s ease; cursor: default;';
                groupLim.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <label for="limit_${code}" style="font-weight: 600; color: #1e293b; margin: 0; font-size: 0.95rem;">الفئة ${code}</label>
                        <span style="font-size: 0.75rem; background: #eff6ff; color: #2563eb; padding: 2px 8px; border-radius: 12px; font-weight: bold;">الحد الأقصى</span>
                    </div>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="number" id="limit_${code}" data-code="${code}" data-type="limit" value="${codeSet.limit}" min="1" required style="width: 100%; padding: 10px 12px; padding-left: 40px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem; color: #0f172a; outline: none; transition: border-color 0.2s; box-sizing: border-box;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#cbd5e1'">
                        <span style="position: absolute; left: 12px; color: #64748b; font-size: 0.85rem;">يوم</span>
                    </div>
                `;
                formLimits.appendChild(groupLim);

                const groupThresh = document.createElement('div');
                groupThresh.style.cssText = 'background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 12px; transition: all 0.2s ease; cursor: default;';
                groupThresh.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                        <div style="font-weight: 600; color: #1e293b; font-size: 0.95rem;">الفئة ${code}</div>
                        <span style="font-size: 0.75rem; background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-weight: bold;">مؤشر الخطر</span>
                    </div>
                    <div style="display:flex; gap:10px; align-items: center;">
                        <div style="flex:1; position: relative;">
                            <label style="font-size:0.8rem; color:#64748b; margin-bottom: 4px; display: block;">أقل من (أحمر):</label>
                            <div style="position: relative; display: flex; align-items: center;">
                                <input type="number" data-code="${code}" data-type="red" value="${codeSet.red}" min="1" required style="width:100%; padding:8px 10px; padding-left: 35px; border:1px solid #fecaca; border-radius:6px; font-size: 0.95rem; color: #991b1b; outline: none; background: #fffcfc; transition: border-color 0.2s; box-sizing: border-box;" onfocus="this.style.borderColor='#ef4444'" onblur="this.style.borderColor='#fecaca'">
                                <span style="position: absolute; left: 10px; color: #ef4444; font-size: 0.8rem;">أيام</span>
                            </div>
                        </div>
                    </div>
                `;
                formThresholds.appendChild(groupThresh);"""

if target_block in js_content:
    js_content = js_content.replace(target_block, replacement_block)
    with open('static/js/main.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    print("Replaced successfully!")
else:
    print("Target block not found!")
