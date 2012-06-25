from flask import Flask, redirect
from random import choice
from datetime import datetime
import os.path

try:
    import pylibmc
except:
    print "No pylibmc installed"

DIR = os.path.dirname(__file__)

allTitles = {}

app = Flask(__name__)
app.debug = True

mc = pylibmc.Client(["127.0.0.1"], binary=True,
                     behaviors={"tcp_nodelay": True, "ketama": True})

def urlForTitle(title):
    return "//en.wikipedia.org/wiki/" + title

def getTitles(cat):
    def updateTitles():
        with open(os.path.join(DIR, cat)) as f:
            mc[cat] = {
                "lastupdate": datetime.now(),
                "titles": [l.strip() for l in f.readlines()]
                }

    if cat not in mc:
        updateTitles()

    return mc[cat]['titles']

@app.route('/r/<cat>/')
def randomTitle(cat):
   titles = getTitles(str(cat))
   return redirect(urlForTitle(choice(titles)))
    
if __name__ == '__main__':
    app.run()
