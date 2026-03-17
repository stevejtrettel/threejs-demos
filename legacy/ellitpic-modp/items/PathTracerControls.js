// pathTracerControls.js
// Adds manual Pathtrace and Download buttons for three-gpu-pathtracer
// Usage: createPathTracerControls(pathTracer, renderer);

export function createPathTracerControls(pathTracer, renderer) {
    // Disable auto-start after inactivity
    pathTracer.renderDelay = Infinity;
    
    let isPathTracing = false;
    
    // Create styled button
    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 500;
            color: white;
            background: rgba(0, 0, 0, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-height: 44px;
            white-space: nowrap;
        `;
        
        // Hover effects
        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(0, 0, 0, 0.85)';
            button.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = 'rgba(0, 0, 0, 0.7)';
            button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        button.addEventListener('click', onClick);
        return button;
    }
    
    // Save canvas as PNG with timestamp
    function saveImage(canvas) {
        const date = new Date();
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const hour = date.getHours();
        const minute = date.getMinutes();
        
        const link = document.createElement('a');
        link.download = `pathtrace ${month}-${day}-${hour}${minute}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        display: flex;
        gap: 8px;
        z-index: 1000;
    `;
    
    // Add mobile responsiveness
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 768px) {
            ${buttonContainer.getAttribute('style')} {
                top: 12px;
                right: 12px;
                gap: 6px;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Pathtrace button (toggle)
    const pathtraceButton = createButton('Pathtrace', () => {
        if (!isPathTracing) {
            isPathTracing = true;
            pathTracer.renderDelay = 0;
            pathTracer.reset();
            pathtraceButton.textContent = 'Stop';
            pathtraceButton.style.background = 'rgba(220, 38, 38, 0.7)';
        } else {
            isPathTracing = false;
            pathTracer.renderDelay = Infinity;
            pathtraceButton.textContent = 'Pathtrace';
            pathtraceButton.style.background = 'rgba(0, 0, 0, 0.7)';
        }
    });
    
    // Download button
    const downloadButton = createButton('Download', () => {
        saveImage(renderer.domElement);
    });
    
    // Add to page
    buttonContainer.appendChild(pathtraceButton);
    buttonContainer.appendChild(downloadButton);
    document.body.appendChild(buttonContainer);
}