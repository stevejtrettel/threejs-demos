// pathTracerControls.js
export function createPathTracerControls(pathTracer, renderer, getSceneCamera, onBeforePathTrace = null) {
    pathTracer.renderDelay = Infinity;
    console.log('Path tracer controls initialized, renderDelay set to:', pathTracer.renderDelay);
    console.log('onBeforePathTrace callback provided:', !!onBeforePathTrace);

    let isPathTracing = false;

    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 500;
            color: white;
            background: rgba(0, 0, 0, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            white-space: nowrap;
            width: 100%;
        `;

        button.addEventListener('click', onClick);
        return button;
    }

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

    const pathtraceButton = createButton('Pathtrace', async () => {
        console.log('=== PATHTRACE BUTTON CLICKED ===');
        console.log('Current isPathTracing state:', isPathTracing);

        if (!isPathTracing) {
            try {
                isPathTracing = true;

                // Call pre-pathtrace callback if provided (e.g., rebuild geometry at high res)
                if (onBeforePathTrace) {
                    console.log('Calling onBeforePathTrace callback...');
                    await onBeforePathTrace();
                    console.log('onBeforePathTrace complete');
                }

                // Get the scene and camera
                const sceneCamera = getSceneCamera();
                console.log('Got scene/camera:', sceneCamera);
                console.log('Scene children count:', sceneCamera.scene.children.length);

                // Refresh the path tracer scene before starting
                console.log('Calling pathTracer.setScene...');
                pathTracer.setScene(sceneCamera.scene, sceneCamera.camera);
                console.log('setScene complete');

                pathTracer.renderDelay = 0;
                console.log('renderDelay set to:', pathTracer.renderDelay);

                pathTracer.reset();
                console.log('Path tracer reset complete');

                pathtraceButton.textContent = 'Stop';
                pathtraceButton.style.background = 'rgba(220, 38, 38, 0.7)';
                console.log('=== PATH TRACING STARTED ===');
            } catch (error) {
                console.error('Error starting path tracer:', error);
                isPathTracing = false;
            }
        } else {
            isPathTracing = false;
            pathTracer.renderDelay = Infinity;
            console.log('=== PATH TRACING STOPPED ===');
            pathtraceButton.textContent = 'Pathtrace';
            pathtraceButton.style.background = 'rgba(0, 0, 0, 0.7)';
        }
    });

    // Add state-aware hover effects to pathtrace button
    pathtraceButton.addEventListener('mouseenter', () => {
        if (isPathTracing) {
            pathtraceButton.style.background = 'rgba(220, 38, 38, 0.85)';
        } else {
            pathtraceButton.style.background = 'rgba(0, 0, 0, 0.85)';
        }
        pathtraceButton.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    });

    pathtraceButton.addEventListener('mouseleave', () => {
        if (isPathTracing) {
            pathtraceButton.style.background = 'rgba(220, 38, 38, 0.7)';
        } else {
            pathtraceButton.style.background = 'rgba(0, 0, 0, 0.7)';
        }
        pathtraceButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });

    const downloadButton = createButton('Download', () => {
        saveImage(renderer.domElement);
    });

    // Add hover effects to download button
    downloadButton.addEventListener('mouseenter', () => {
        downloadButton.style.background = 'rgba(0, 0, 0, 0.85)';
        downloadButton.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    });

    downloadButton.addEventListener('mouseleave', () => {
        downloadButton.style.background = 'rgba(0, 0, 0, 0.7)';
        downloadButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });

    // Return buttons and control object
    return {
        buttons: [pathtraceButton, downloadButton],
        isPathTracing: () => isPathTracing,
    };
}
