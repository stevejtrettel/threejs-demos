// customSliders.js
export function createSliderControl(label, min, max, initialValue, step, onChange) {
    const container = document.createElement('div');
    container.style.cssText = `
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 8px 12px;
        backdrop-filter: blur(10px);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        min-width: 180px;
    `;

    // Label and value display
    const labelContainer = document.createElement('div');
    labelContainer.style.cssText = `
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        color: white;
        font-size: 12px;
        font-weight: 500;
    `;

    const labelText = document.createElement('span');
    labelText.textContent = label;

    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = initialValue.toFixed(2);
    valueDisplay.style.color = 'rgba(255, 255, 255, 0.7)';

    labelContainer.appendChild(labelText);
    labelContainer.appendChild(valueDisplay);

    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.value = initialValue;
    slider.step = step;
    slider.style.cssText = `
        width: 100%;
        height: 3px;
        -webkit-appearance: none;
        appearance: none;
        background: rgba(255, 255, 255, 0.2);
        outline: none;
        border-radius: 2px;
        cursor: pointer;
    `;

    // Slider thumb styling
    const style = document.createElement('style');
    style.textContent = `
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
            cursor: pointer;
            transition: transform 0.1s ease;
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
            transform: scale(1.15);
        }
        
        input[type="range"]::-moz-range-thumb {
            width: 12px;
            height: 12px;
            background: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            transition: transform 0.1s ease;
        }
        
        input[type="range"]::-moz-range-thumb:hover {
            transform: scale(1.15);
        }
    `;
    document.head.appendChild(style);

    // Update on change
    slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        valueDisplay.textContent = value.toFixed(2);
        onChange(value);
    });

    container.appendChild(labelContainer);
    container.appendChild(slider);

    return {
        element: container,
        setValue: (value) => {
            slider.value = value;
            valueDisplay.textContent = value.toFixed(2);
        },
        getValue: () => parseFloat(slider.value)
    };
}

export function createSliderPanel(sliders, pathTracerButtons = []) {
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    `;

    // Toggle button
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '⚙️ Controls';
    toggleButton.style.cssText = `
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        padding: 8px 12px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        backdrop-filter: blur(10px);
        transition: background 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
    `;

    toggleButton.addEventListener('mouseenter', () => {
        toggleButton.style.background = 'rgba(0, 0, 0, 0.9)';
    });

    toggleButton.addEventListener('mouseleave', () => {
        toggleButton.style.background = 'rgba(0, 0, 0, 0.8)';
    });

    // Controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        transition: max-height 0.3s ease, opacity 0.3s ease;
        min-width: 180px;
    `;

    // Add path tracer buttons in a horizontal container (if provided)
    if (pathTracerButtons.length > 0) {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            gap: 6px;
        `;

        pathTracerButtons.forEach(button => {
            // Remove the full width styling from buttons
            button.style.width = 'auto';
            button.style.flex = '1';
            buttonsContainer.appendChild(button);
        });

        controlsContainer.appendChild(buttonsContainer);
    }

    // Add separator if we have both buttons and sliders
    if (pathTracerButtons.length > 0 && sliders.length > 0) {
        const separator = document.createElement('div');
        separator.style.cssText = `
            height: 1px;
            background: rgba(255, 255, 255, 0.2);
            margin: 4px 0;
        `;
        controlsContainer.appendChild(separator);
    }

    // Add sliders
    sliders.forEach(slider => {
        controlsContainer.appendChild(slider.element);
    });

    // Toggle functionality
    let isExpanded = false;
    toggleButton.addEventListener('click', () => {
        isExpanded = !isExpanded;

        if (isExpanded) {
            toggleButton.textContent = '▼ Controls';
            controlsContainer.style.maxHeight = `${controlsContainer.scrollHeight}px`;
            controlsContainer.style.opacity = '1';
        } else {
            toggleButton.textContent = '⚙️ Controls';
            controlsContainer.style.maxHeight = '0';
            controlsContainer.style.opacity = '0';
        }
    });

    panel.appendChild(toggleButton);
    panel.appendChild(controlsContainer);
    document.body.appendChild(panel);

    return panel;
}
