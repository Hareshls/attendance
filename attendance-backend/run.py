import uvicorn

if __name__ == "__main__":
    print("Starting Attendance API on 0.0.0.0:8000...")
    print("This allows devices on the same network (like your iPhone) to connect!")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
