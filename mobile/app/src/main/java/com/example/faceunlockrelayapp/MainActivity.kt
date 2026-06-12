package com.example.faceunlockrelayapp

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.*
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import org.tensorflow.lite.Interpreter
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.sqrt

class MainActivity : AppCompatActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var statusText: TextView
    private lateinit var startButton: Button
    private lateinit var registerButton: Button
    private lateinit var cameraExecutor: ExecutorService

    private var registrationMode = false
    private var faceRegistered = false
    
    // Liveness states
    private var lookedLeft = false
    private var lookedRight = false

    private var faceNetInterpreter: Interpreter? = null
    private var registeredEmbedding: FloatArray? = null
    
    // Security threshold
    private val RECOGNITION_THRESHOLD = 0.95f 
    private var recognitionEnabled = false

    private lateinit var sharedPreferences: SharedPreferences
    private val PREFS_NAME = "FaceUnlockPrefs"
    private val KEY_EMBEDDING = "registered_embedding"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)

        previewView = findViewById(R.id.previewView)
        statusText = findViewById(R.id.statusText)
        startButton = findViewById(R.id.startButton)
        registerButton = findViewById(R.id.registerButton)

        sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        cameraExecutor = Executors.newSingleThreadExecutor()

        // Load saved data
        loadSavedEmbedding()
        if (faceRegistered) loadFaceNetModel()

        // REGISTER BUTTON: Click to start registration
        registerButton.setOnClickListener {
            loadFaceNetModel()
            registrationMode = true
            lookedLeft = false
            lookedRight = false
            recognitionEnabled = false
            statusText.text = "Registration: Look LEFT"
            resetUI()
        }

        // RESET FEATURE: Long press Register button to erase faces
        registerButton.setOnLongClickListener {
            clearRegisteredFace()
            true
        }

        startButton.setOnClickListener {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                if (!faceRegistered) {
                    statusText.text = "Please register face first"
                } else {
                    loadFaceNetModel()
                    recognitionEnabled = true
                    statusText.text = "Scanning..."
                    startCamera()
                }
            } else {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), 100)
            }
        }
    }

    private fun clearRegisteredFace() {
        sharedPreferences.edit().remove(KEY_EMBEDDING).apply()
        registeredEmbedding = null
        faceRegistered = false
        recognitionEnabled = false
        registrationMode = false
        statusText.text = "Memory Erased. Please register."
        resetUI()
        Toast.makeText(this, "All registered faces erased", Toast.LENGTH_SHORT).show()
    }

    private fun resetUI() {
        runOnUiThread {
            startButton.text = "Start Face Scan"
            startButton.setBackgroundColor(ContextCompat.getColor(this, com.google.android.material.R.color.design_default_color_primary))
        }
    }

    private fun loadSavedEmbedding() {
        val savedString = sharedPreferences.getString(KEY_EMBEDDING, null)
        if (!savedString.isNullOrEmpty()) {
            try {
                val stringArray = savedString.split(",").toTypedArray()
                registeredEmbedding = FloatArray(stringArray.size) { i -> stringArray[i].toFloat() }
                faceRegistered = true
                statusText.text = "Registered Face Detected. Press Scan."
            } catch (e: Exception) { e.printStackTrace() }
        } else {
            statusText.text = "No face registered."
        }
    }

    private fun saveEmbedding(embedding: FloatArray) {
        val stringBuilder = StringBuilder()
        for (i in embedding.indices) {
            stringBuilder.append(embedding[i])
            if (i < embedding.size - 1) stringBuilder.append(",")
        }
        sharedPreferences.edit().putString(KEY_EMBEDDING, stringBuilder.toString()).apply()
        registeredEmbedding = embedding 
        faceRegistered = true
    }

    private fun loadFaceNetModel() {
        if (faceNetInterpreter != null) return
        try {
            val fileDescriptor = assets.openFd("facenet.tflite")
            val inputStream = fileDescriptor.createInputStream()
            val fileChannel = inputStream.channel
            val modelBuffer: MappedByteBuffer = fileChannel.map(
                FileChannel.MapMode.READ_ONLY,
                fileDescriptor.startOffset,
                fileDescriptor.declaredLength
            )
            faceNetInterpreter = Interpreter(modelBuffer)
        } catch (e: Exception) { e.printStackTrace() }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val preview = Preview.Builder().build()
            preview.setSurfaceProvider(previewView.surfaceProvider)

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            val detectorOptions = FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .build()

            val detector = FaceDetection.getClient(detectorOptions)
            var isProcessing = false

            imageAnalyzer.setAnalyzer(cameraExecutor) { imageProxy ->
                if (isProcessing) {
                    imageProxy.close()
                    return@setAnalyzer
                }
                val mediaImage = imageProxy.image ?: return@setAnalyzer
                isProcessing = true
                val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

                detector.process(image)
                    .addOnSuccessListener { faces ->
                        if (faces.isNotEmpty()) {
                            val face = faces[0]
                            if (registrationMode) {
                                handleRegistration(face, imageProxy)
                            } else if (faceRegistered && recognitionEnabled) {
                                handleRecognition(face, imageProxy)
                            }
                        } else {
                            if (recognitionEnabled) {
                                runOnUiThread {
                                    statusText.text = "Searching..."
                                    resetUI()
                                }
                            }
                        }
                    }
                    .addOnCompleteListener {
                        isProcessing = false
                        imageProxy.close()
                    }
            }
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, imageAnalyzer)
        }, ContextCompat.getMainExecutor(this))
    }

    private fun handleRegistration(face: Face, imageProxy: ImageProxy) {
        val headY = face.headEulerAngleY

        if (!lookedLeft) {
            runOnUiThread { statusText.text = "Registration: Look LEFT" }
            if (headY < -20) lookedLeft = true
            return
        }

        if (!lookedRight) {
            runOnUiThread { statusText.text = "Registration: Look RIGHT" }
            if (headY > 20) lookedRight = true
            return
        }

        runOnUiThread { statusText.text = "Registration: Look STRAIGHT" }
        if (Math.abs(headY) < 5.0) { 
            val embedding = getEmbedding(face, imageProxy)
            if (embedding != null) {
                saveEmbedding(embedding)
                registrationMode = false
                runOnUiThread {
                    statusText.text = "Recognized Face - Access Granted"
                    startButton.text = "ACCESS GRANTED"
                    startButton.setBackgroundColor(Color.parseColor("#4CAF50"))
                }
            }
        }
    }

    private fun handleRecognition(face: Face, imageProxy: ImageProxy) {
        val embedding = getEmbedding(face, imageProxy)
        if (embedding != null && registeredEmbedding != null) {
            val distance = calculateDistance(embedding, registeredEmbedding!!)
            
            runOnUiThread {
                if (distance < RECOGNITION_THRESHOLD) {
                    statusText.text = "Recognized Face - Access Granted"
                    startButton.text = "ACCESS GRANTED"
                    startButton.setBackgroundColor(Color.parseColor("#4CAF50"))
                } else {
                    statusText.text = "Unrecognized Face - Locked"
                    startButton.text = "LOCKED"
                    startButton.setBackgroundColor(Color.RED)
                }
            }
        }
    }

    private fun getEmbedding(face: Face, imageProxy: ImageProxy): FloatArray? {
        if (faceNetInterpreter == null) return null
        try {
            val bitmap = imageProxyToBitmap(imageProxy) ?: return null
            val rotatedBitmap = rotateBitmap(bitmap, imageProxy.imageInfo.rotationDegrees.toFloat())
            val boundingBox = face.boundingBox
            
            val left = boundingBox.left.coerceAtLeast(0)
            val top = boundingBox.top.coerceAtLeast(0)
            val width = boundingBox.width().coerceAtMost(rotatedBitmap.width - left)
            val height = boundingBox.height().coerceAtMost(rotatedBitmap.height - top)
            
            if (width <= 0 || height <= 0) return null
            val faceBitmap = Bitmap.createBitmap(rotatedBitmap, left, top, width, height)
            val scaledBitmap = Bitmap.createScaledBitmap(faceBitmap, 160, 160, true)

            val inputBuffer = ByteBuffer.allocateDirect(1 * 160 * 160 * 3 * 4).order(ByteOrder.nativeOrder())
            val intValues = IntArray(160 * 160)
            scaledBitmap.getPixels(intValues, 0, 160, 0, 0, 160, 160)
            for (pixelValue in intValues) {
                inputBuffer.putFloat(((pixelValue shr 16 and 0xFF) - 127.5f) / 128.0f)
                inputBuffer.putFloat(((pixelValue shr 8 and 0xFF) - 127.5f) / 128.0f)
                inputBuffer.putFloat(((pixelValue and 0xFF) - 127.5f) / 128.0f)
            }
            val outputBuffer = Array(1) { FloatArray(128) }
            faceNetInterpreter?.run(inputBuffer, outputBuffer)
            return l2Normalize(outputBuffer[0])
        } catch (e: Exception) { return null }
    }

    private fun l2Normalize(embedding: FloatArray): FloatArray {
        var sum = 0.0f
        for (v in embedding) sum += v * v
        val norm = sqrt(sum.toDouble()).toFloat()
        for (i in embedding.indices) embedding[i] /= norm
        return embedding
    }

    private fun imageProxyToBitmap(image: ImageProxy): Bitmap? {
        val yBuffer = image.planes[0].buffer
        val uBuffer = image.planes[1].buffer
        val vBuffer = image.planes[2].buffer
        val nv21 = ByteArray(yBuffer.remaining() + uBuffer.remaining() + vBuffer.remaining())
        yBuffer.get(nv21, 0, yBuffer.remaining())
        vBuffer.get(nv21, yBuffer.remaining(), vBuffer.remaining())
        uBuffer.get(nv21, yBuffer.remaining() + vBuffer.remaining(), uBuffer.remaining())
        val yuvImage = YuvImage(nv21, ImageFormat.NV21, image.width, image.height, null)
        val out = ByteArrayOutputStream()
        yuvImage.compressToJpeg(Rect(0, 0, yuvImage.width, yuvImage.height), 100, out)
        return BitmapFactory.decodeByteArray(out.toByteArray(), 0, out.size())
    }

    private fun rotateBitmap(source: Bitmap, angle: Float): Bitmap {
        val matrix = Matrix()
        matrix.postRotate(angle)
        return Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
    }

    private fun calculateDistance(e1: FloatArray, e2: FloatArray): Float {
        var sum = 0.0f
        for (i in e1.indices) {
            val diff = e1[i] - e2[i]
            sum += diff * diff
        }
        return sqrt(sum.toDouble()).toFloat()
    }

    override fun onDestroy() {
        super.onDestroy()
        faceNetInterpreter?.close()
        cameraExecutor.shutdown()
    }
}
