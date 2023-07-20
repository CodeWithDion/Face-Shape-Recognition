Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models')
]).then(startFaceRecognition);

function startFaceRecognition() {
    const video = document.getElementById('video');
    const resultContainer = document.getElementById('result-container');

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(error => {
            console.error(error);
        });

    video.addEventListener('play', () => {
        const canvas = faceapi.createCanvasFromMedia(video);
        document.body.append(canvas);

        const displaySize = { width: video.width, height: video.height };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

            resizedDetections.forEach(detection => {
                const faceLandmarks = detection.landmarks;
                const faceShape = analyzeFaceShape(faceLandmarks);

                // Update the result container with the face shape
                resultContainer.textContent = `Face Shape: ${faceShape}`;

                const box = detection.detection.box;
                const drawOptions = {
                    label: faceShape,
                    lineWidth: 2,
                    boxColor: '#FF0000',
                    textColor: '#FF0000',
                    fontSize: 12
                };
                const drawBox = new faceapi.draw.DrawBox(box, drawOptions);
                drawBox.draw(canvas);

            });
        }, 100);
    });
}


function calculateFaceMeasurements(faceLandmarks) {
    const leftEyebrowLandmarks = faceLandmarks.getLeftEyeBrow();
    const rightEyebrowLandmarks = faceLandmarks.getRightEyeBrow();

    // Sort left eyebrow landmarks in ascending order based on x-coordinate
    const sortedLeftEyebrow = leftEyebrowLandmarks.sort((a, b) => a.x - b.x);

    // Sort right eyebrow landmarks in descending order based on x-coordinate
    const sortedRightEyebrow = rightEyebrowLandmarks.sort((a, b) => b.x - a.x);

    // Get the leftmost and rightmost landmarks
    const leftmostLandmark = sortedLeftEyebrow[0];
    const rightmostLandmark = sortedRightEyebrow[0];

    const foreheadWidth = rightmostLandmark.x - leftmostLandmark.x;

    const jawline = faceLandmarks.getJawOutline();
    const centerJawlineIndex = Math.floor(jawline.length / 2);

    // Calculate cheekboneWidth
    const intersection1 = getIntersectionPoint(jawline[0], jawline[centerJawlineIndex], jawline[1], jawline[15]);
    const intersection2 = getIntersectionPoint(jawline[16], jawline[centerJawlineIndex], jawline[1], jawline[15]);

    let cheekboneWidth;
    if (intersection1 && intersection2) {
        cheekboneWidth = Math.sqrt(Math.pow(intersection1.x - intersection2.x, 2) + Math.pow(intersection1.y - intersection2.y, 2));
    } else {
        cheekboneWidth = 0; // Set cheekboneWidth to a default value or handle the scenario accordingly
    }

    let jawlineLengthFromCenter = 0;
    for (let i = 3; i <= centerJawlineIndex; i++) {
        const startPoint = jawline[i - 1];
        const endPoint = jawline[i];
        const length = Math.sqrt(Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2));
        jawlineLengthFromCenter += length;
    }

    return {
        foreheadWidth,
        cheekboneWidth,
        jawlineLengthFromCenter
    };
}


// Helper function to calculate the intersection point of two lines
function getIntersectionPoint(p1, p2, p3, p4) {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if (d === 0) {
        return null; // Lines are parallel
    }

    const intersectX = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / d;
    const intersectY = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / d;

    // Check if the intersection point is within the line segments
    if (
        intersectX < Math.min(x1, x2) ||
        intersectX > Math.max(x1, x2) ||
        intersectY < Math.min(y1, y2) ||
        intersectY > Math.max(y1, y2) ||
        intersectX < Math.min(x3, x4) ||
        intersectX > Math.max(x3, x4) ||
        intersectY < Math.min(y3, y4) ||
        intersectY > Math.max(y3, y4)
    ) {
        return null;
    }

    return { x: intersectX, y: intersectY };
}


function analyzeFaceShape(faceLandmarks) {
    const measurements = calculateFaceMeasurements(faceLandmarks);

    const {
        foreheadWidth,
        cheekboneWidth,
        jawlineLengthFromCenter
    } = measurements;

    if (cheekboneWidth > foreheadWidth && foreheadWidth > jawlineLengthFromCenter) {
        return 'Diamond, Round, Oval';
    } else if (jawlineLengthFromCenter > cheekboneWidth && cheekboneWidth > foreheadWidth) {
        return 'Triangle';
    } else if (foreheadWidth > cheekboneWidth && foreheadWidth > jawlineLengthFromCenter) {
        return 'Heart';
    } else if (jawlineLengthFromCenter === cheekboneWidth && cheekboneWidth === foreheadWidth) {
        return 'Square, Oblong';
    } else {
        return ''; // Return an empty string for unrecognized face shapes
    }
}
