import matplotlib.pyplot as plt
import numpy as np
import matplotlib.ticker as ticker
from matplotlib.lines import Line2D

def generate_synthetic_data(n=350):
    """
    Generates synthetic data mimicking the distribution in the image.
    X: Log-normal distribution centered roughly at 10.
    Y: Correlated with log(X) + noise.
    Duration (Color): Radial gradient from the center of the cluster (purple core, yellow edges).
    Amplitude (Size): Random uniform distribution.
    """
    np.random.seed(42)
    
    # X data: Log-normal distribution
    # log10(x) centered at 1.0 (which is x=10), sigma=0.35 covers range 1-100 well
    log_x = np.random.normal(loc=1.0, scale=0.35, size=n)
    x = 10**log_x
    
    # Y data: Linear correlation with log_x
    # Slope approx 1.0, Intercept approx 1.0
    # Add noise
    y = 0.8 * log_x + 1.2 + np.random.normal(0, 0.35, size=n)
    
    # Duration (Color mapping): 
    # Visually, the core is purple (low values) and outliers are yellow (high values).
    # We calculate the Mahalanobis distance or simple Euclidean distance in normalized space.
    norm_x = (log_x - np.mean(log_x)) / np.std(log_x)
    norm_y = (y - np.mean(y)) / np.std(y)
    distance = np.sqrt(norm_x**2 + norm_y**2)
    
    # Map distance to range 1 to 3
    # Normalize distance to 0-1 then scale
    dist_norm = (distance - distance.min()) / (distance.max() - distance.min())
    # Bias towards lower values to match the "purple core" look
    duration = 1 + 2.5 * (dist_norm ** 1.5) 
    duration = np.clip(duration, 1, 3) # Clip to legend range
    
    # Amplitude (Size mapping): Random values between 30 and 60
    # Some correlation with Y to make higher points slightly larger? 
    # The image shows a mix, but let's keep it mostly random with slight bias.
    amplitude = np.random.uniform(20, 70, size=n)
    
    return x, y, duration, amplitude

def draw_plot():
    # 1. Setup Figure
    fig, ax = plt.subplots(figsize=(6, 5.5), facecolor='white')
    
    # 2. Generate Data
    x, y, duration, amplitude = generate_synthetic_data()
    
    # 3. Plot Scatter
    # Use viridis colormap
    scatter = ax.scatter(
        x, y, 
        c=duration, 
        s=amplitude, 
        cmap='viridis', 
        edgecolors='black', 
        linewidths=0.7, 
        alpha=0.9,
        zorder=2
    )
    
    # 4. Configure Axes
    # X Axis - Log Scale
    ax.set_xscale('log')
    ax.set_xlim(1, 100)
    ax.xaxis.set_major_formatter(ticker.FuncFormatter(lambda y, _: '{:g}'.format(y)))
    ax.set_xlabel(r'dissociation constant $K$ (M)', fontsize=14, labelpad=5)
    
    # Y Axis - Linear Scale
    ax.set_ylim(0, 4)
    ax.set_yticks(np.arange(0, 4.1, 0.5))
    # Only label integer ticks to match style if needed, but image shows 0.0, 0.5... actually image shows 0.0, 0.5, 1.0...
    # Let's stick to standard labeling
    ax.set_ylabel('Hill coefficient n', fontsize=14, labelpad=5)
    
    # Ticks style
    ax.tick_params(axis='both', which='major', direction='in', length=6, width=1, labelsize=12)
    ax.tick_params(axis='both', which='minor', direction='in', length=3, width=1)
    
    # Spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_linewidth(1.0)
    ax.spines['bottom'].set_linewidth(1.0)
    
    # 5. Add Subplot Label "F"
    # Position in figure coordinates relative to axes
    ax.text(-0.15, 1.0, 'F', transform=ax.transAxes, 
            fontsize=20, fontweight='bold', va='bottom', ha='right')

    # 6. Custom Legends
    
    # A. Size Legend ("amplitude")
    # Create dummy handles
    sizes = [30, 40, 50, 60]
    legend_elements = [Line2D([0], [0], marker='o', color='w', label=str(s),
                              markerfacecolor='white', markeredgecolor='black', markersize=np.sqrt(s)*1.2) # Scaling for visual match
                       for s in sizes]
    
    # Place legend
    leg1 = ax.legend(handles=legend_elements, title='amplitude', 
                     loc='center left', bbox_to_anchor=(1.02, 0.6),
                     frameon=False, title_fontsize=10, fontsize=10, labelspacing=0.8)
    leg1._legend_box.align = "left"
    
    # B. Colorbar ("duration")
    # Create an inset axes for the colorbar
    # [left, bottom, width, height] in figure coordinates or relative to parent
    cax = ax.inset_axes([1.05, 0.25, 0.03, 0.2]) 
    cbar = plt.colorbar(scatter, cax=cax, orientation='vertical', ticks=[1, 2, 3])
    cbar.ax.set_title('duration', fontsize=10, loc='left', pad=10)
    cbar.ax.tick_params(labelsize=10, size=0) # Hide ticks, keep labels
    cbar.outline.set_visible(False) # Remove outline box if desired, or keep it
    
    # Adjust layout to prevent clipping
    plt.tight_layout()
    plt.subplots_adjust(right=0.75) # Make room for legends on the right
    
    return fig

if __name__ == "__main__":
    fig = draw_plot()
    plt.show()