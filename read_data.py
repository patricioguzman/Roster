with open("backend/server.js", "r") as f:
    lines = f.readlines()
    for i in range(74, 150):
        print(f"{i}: {lines[i-1].rstrip()}")
